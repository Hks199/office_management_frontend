import { z } from 'zod';
import { request } from './api';

const intentSchema = z.object({
  fileId: z.string().regex(/^[a-f\d]{24}$/i),
  upload: z.object({
    method: z.literal('POST'),
    url: z.url(),
    fields: z.record(z.string(), z.string()),
  }),
});
export function validateStorageUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !url.hostname.endsWith('.amazonaws.com')
  )
    throw new Error('The server returned an unsupported storage destination.');
  return url.href;
}
export async function checksum(file: File) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}
export async function uploadFile(
  file: File,
  intentPath: string,
  confirmPath: (id: string) => string,
  extra: Record<string, unknown> = {},
) {
  const response = await request(intentPath, {
    method: 'POST',
    body: { filename: file.name, size: file.size, checksumSHA256: await checksum(file), ...extra },
  });
  const intent = intentSchema.parse(response.data);
  const url = validateStorageUrl(intent.upload.url);
  const form = new FormData();
  Object.entries(intent.upload.fields).forEach(([key, value]) => form.append(key, value));
  form.append('file', file);
  // Signed fields authorize this transfer; API authorization is never sent to object storage.
  let result: Response;
  try {
    result = await fetch(url, {
      method: 'POST',
      body: form,
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    )
      throw new Error('The file upload timed out. Check your connection and try again.');
    throw new Error(
      `The browser could not reach private file storage. Check your connection. If it persists, ask your administrator to allow ${window.location.origin} in the S3 bucket CORS settings and check storage access.`,
    );
  }
  if (!result.ok)
    throw new Error(
      result.status === 403
        ? 'Private file storage denied the upload. Try again with a fresh upload; if it persists, ask your administrator to check S3 write permissions.'
        : 'Private file storage rejected the upload. Please retry; if it persists, ask your administrator to check storage configuration.',
    );
  await request(confirmPath(intent.fileId), { method: 'POST' });
  return intent.fileId;
}
export function validatePhoto(file?: File): asserts file is File {
  if (!file) throw new Error('Select a photo.');
  if (file.size < 12 || file.size > 5 * 1024 * 1024)
    throw new Error('Photos must be between 12 bytes and 5 MB.');
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  const types: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
  };
  if (
    !extension ||
    !types[file.type]?.includes(extension) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}\.(jpg|jpeg|png|webp)$/i.test(file.name)
  )
    throw new Error(
      'Use a JPG, PNG, or WebP photo with a simple filename (letters, numbers, underscores, and hyphens).',
    );
}
export function getLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (
          !Number.isFinite(latitude) ||
          Math.abs(latitude) > 90 ||
          !Number.isFinite(longitude) ||
          Math.abs(longitude) > 180 ||
          !Number.isFinite(accuracy) ||
          accuracy < 0 ||
          accuracy > 100000
        ) {
          reject(
            new Error(
              'The device returned an invalid GPS position. Enable precise location and try again.',
            ),
          );
          return;
        }
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        });
      },
      (error) =>
        reject(
          new Error(
            error.code === 1
              ? 'Location permission was denied. Allow location access in your browser site settings, then try again.'
              : error.code === 3
                ? 'GPS timed out. Turn on device location services, move to a clearer area and try again.'
                : 'GPS is unavailable. Turn on device location services and enable precise location, then try again.',
          ),
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  });
}
