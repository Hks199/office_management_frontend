import { z } from 'zod';
import type { ApiResponse } from '../types/api';

const credentialsSchema = z.object({
  accessToken: z.string().min(1),
  csrfToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  expiresIn: z.number().positive(),
});
let accessToken: string | undefined;
let csrfToken: string | undefined;
let employeePanelToken: string | undefined;
export function setEmployeePanelToken(token?: string) {
  if (token !== undefined && !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new Error('Invalid employee panel');
  employeePanelToken = token;
}
let refreshPromise: Promise<void> | undefined;
let sessionEpoch = 0;
const listeners = new Set<() => void>();
// Only controlled public error codes get a specific 5xx message. Provider/driver
// error text may contain secrets and must stay hidden.
const serviceMessages = new Map<string, string>([
  [
    'STORAGE_ACCESS_DENIED',
    'AWS denied access to private file storage. Ask your administrator to check S3 read/write permissions and explicit Deny policies for the backend IAM identity. Read access is required to verify uploaded files.',
  ],
  [
    'STORAGE_CREDENTIALS_INVALID',
    'AWS storage credentials are missing, invalid or expired. Ask your administrator to update the backend credentials and restart the backend.',
  ],
  [
    'STORAGE_REGION_MISMATCH',
    'The backend AWS_REGION does not match the S3 bucket region. Ask your administrator to correct the storage configuration.',
  ],
  [
    'STORAGE_BUCKET_NOT_FOUND',
    'The configured S3 bucket could not be found. Ask your administrator to check the bucket name and AWS account.',
  ],
  [
    'STORAGE_REQUEST_FAILED',
    'Private file storage could not be reached or verified. Check your connection or ask your administrator to check AWS connectivity.',
  ],
  [
    'COMMERCIAL_NOT_INITIALIZED',
    'Lead workflow setup is incomplete. Ask your administrator to complete the lead setup, then try again.',
  ],
  [
    'STORAGE_UNAVAILABLE',
    'Private file storage is not configured. Ask your administrator to set AWS_REGION and S3_BUCKET in the backend environment and configure AWS access.',
  ],
  [
    'STORAGE_UNSAFE',
    'Private file storage is not ready. Ask your administrator to check bucket versioning, encryption and public access protection.',
  ],
]);

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export function onSessionExpired(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function clearSession() {
  sessionEpoch++;
  accessToken = undefined;
  csrfToken = undefined;
  employeePanelToken = undefined;
}
export function hasAccessToken() {
  return Boolean(accessToken);
}
export function setCredentials(value: unknown) {
  const credentials = credentialsSchema.parse(value);
  accessToken = credentials.accessToken;
  csrfToken = credentials.csrfToken;
}
function expireSession() {
  clearSession();
  listeners.forEach((listener) => listener());
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  anonymous?: boolean;
  csrf?: boolean;
  idempotencyKey?: string;
  retry?: boolean;
};
export async function request<T>(path: string, options: Options = {}): Promise<ApiResponse<T>> {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://') || path.includes('..'))
    throw new Error('Invalid API path');
  const headers = new Headers({ Accept: 'application/json' });
  const requestPanel = options.anonymous ? undefined : employeePanelToken;
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (!options.anonymous && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (requestPanel) headers.set('X-Employee-Panel', requestPanel);
  if (options.csrf && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Unable to reach the server. Check your connection and try again.',
    );
  }
  if (!options.anonymous && requestPanel !== employeePanelToken)
    throw new ApiError(
      409,
      'EMPLOYEE_PANEL_CHANGED',
      'The active account changed. Reload this page before continuing.',
    );
  if (response.status === 401 && !options.anonymous && options.retry !== false) {
    await refreshSession();
    if (requestPanel !== employeePanelToken)
      throw new ApiError(
        409,
        'EMPLOYEE_PANEL_CHANGED',
        'The active account changed. Reload this page before continuing.',
      );
    return request<T>(path, { ...options, retry: false });
  }
  const payload: unknown = await response.json().catch(() => null);
  const envelope = z
    .object({
      success: z.boolean(),
      message: z.string(),
      data: z.unknown().optional(),
      error: z.object({ code: z.string() }).passthrough().optional(),
    })
    .safeParse(payload);
  if (!response.ok || !envelope.success || !envelope.data.success) {
    if (response.status === 401 && !options.anonymous) expireSession();
    const message =
      response.status === 429
        ? 'Too many requests. Please wait before trying again.'
        : response.status === 409 && envelope.success && envelope.data.error?.code === 'CONFLICT'
          ? 'This record has changed. Refresh it before saving again.'
          : response.status >= 500
            ? ((response.status === 503 && envelope.success
                ? serviceMessages.get(envelope.data.error?.code ?? '')
                : undefined) ?? 'The server could not complete your request. Please try again.')
            : envelope.success
              ? envelope.data.message
              : 'The server returned an unexpected response.';
    throw new ApiError(
      response.status,
      envelope.success ? (envelope.data.error?.code ?? 'REQUEST_FAILED') : 'INVALID_RESPONSE',
      message,
      response.headers.get('X-Request-ID') ?? undefined,
    );
  }
  return payload as ApiResponse<T>;
}

export async function refreshSession() {
  if (!refreshPromise) {
    const epoch = sessionEpoch;
    const refresh = async () => {
      const csrf = await request<{ csrfToken: string }>('/auth/csrf', {
        anonymous: true,
        retry: false,
      });
      if (epoch !== sessionEpoch) throw new ApiError(401, 'SESSION_ENDED', 'Please sign in again.');
      csrfToken = z
        .string()
        .regex(/^[A-Za-z0-9_-]{43}$/)
        .parse(csrf.data.csrfToken);
      const result = await request('/auth/refresh', {
        method: 'POST',
        anonymous: true,
        csrf: true,
        retry: false,
      });
      if (epoch !== sessionEpoch) throw new ApiError(401, 'SESSION_ENDED', 'Please sign in again.');
      setCredentials(result.data);
    };
    // Serialize rotating refresh-cookie exchanges across tabs on the same origin.
    refreshPromise = (
      navigator.locks
        ? navigator.locks.request('sunvika-session-refresh', refresh).then(() => undefined)
        : refresh()
    )
      .catch((error: unknown) => {
        if (epoch === sessionEpoch) expireSession();
        throw error;
      })
      .finally(() => {
        refreshPromise = undefined;
      });
  }
  return refreshPromise;
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
