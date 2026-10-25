import { request } from './api';
import type { RecordData } from '../types/api';

export async function lookupOptions(path: string, signal: AbortSignal) {
  const first = await request<RecordData[]>(path, { signal });
  // Receiving branches must include every active branch, even beyond one API page.
  // Other lookups retain their existing search and pagination behavior.
  if (path.split('?')[0] !== '/leads/branch-options') return first;

  const records = [...first.data];
  const [endpoint, query] = path.split('?');
  const params = new URLSearchParams(query);
  const totalPages = first.meta?.totalPages ?? 1;
  for (let page = 2; page <= totalPages; page++) {
    signal.throwIfAborted();
    params.set('page', String(page));
    const next = await request<RecordData[]>(`${endpoint}?${params}`, { signal });
    records.push(...next.data);
  }
  return { ...first, data: records };
}
