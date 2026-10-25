import { beforeEach, expect, it, vi } from 'vitest';
import { request } from './api';
import { lookupOptions } from './lookup-options';

vi.mock('./api', () => ({ request: vi.fn() }));
beforeEach(() => vi.mocked(request).mockReset());

const response = (data: { _id: string }[], totalPages = 2) => ({
  success: true,
  message: 'Options',
  data,
  meta: { page: 1, limit: 100, total: 101, totalPages },
});

it('includes receiving branches beyond the first 100 and preserves search and cancellation', async () => {
  const first = Array.from({ length: 100 }, (_, i) => ({ _id: String(i) }));
  vi.mocked(request).mockResolvedValueOnce(response(first));
  vi.mocked(request).mockResolvedValueOnce(response([{ _id: 'last-active-branch' }]));
  const signal = new AbortController().signal;
  const result = await lookupOptions('/leads/branch-options?limit=100&search=North', signal);
  expect(result.data).toHaveLength(101);
  expect(result.data.at(-1)?._id).toBe('last-active-branch');
  expect(request).toHaveBeenLastCalledWith('/leads/branch-options?limit=100&search=North&page=2', {
    signal,
  });
});

it('fails the whole lookup when a later page fails instead of offering an incomplete list', async () => {
  vi.mocked(request).mockResolvedValueOnce(response([{ _id: 'first' }]));
  vi.mocked(request).mockRejectedValueOnce(new Error('Unavailable'));
  await expect(
    lookupOptions('/leads/branch-options?limit=100', new AbortController().signal),
  ).rejects.toThrow('Unavailable');
});

it('keeps unrelated lookup limits unchanged', async () => {
  vi.mocked(request).mockResolvedValueOnce(response([{ _id: 'employee' }]));
  await lookupOptions('/employees?limit=100', new AbortController().signal);
  expect(request).toHaveBeenCalledTimes(1);
});
