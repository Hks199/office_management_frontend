import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadFile, validatePhoto, validateStorageUrl } from './uploads';
import { request } from './api';
vi.mock('./api', () => ({ request: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

function prepareUpload() {
  const file = new File(['x'], 'contacts.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(new ArrayBuffer(1)) });
  vi.stubGlobal('crypto', { subtle: { digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)) } });
  vi.mocked(request).mockReset();
  vi.mocked(request).mockResolvedValueOnce({
    success: true,
    message: 'Authorized',
    data: {
      fileId: 'a'.repeat(24),
      upload: {
        method: 'POST',
        url: 'https://bucket.s3.ap-south-2.amazonaws.com/',
        fields: { key: 'private/contacts.csv' },
      },
    },
  });
  return file;
}
describe('private upload boundary', () => {
  it('explains browser network/CORS failures and never confirms a failed upload', async () => {
    const file = prepareUpload();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(
      uploadFile(file, '/csv-imports/upload-intents', (id) => `/csv-imports/files/${id}/confirm`),
    ).rejects.toThrow('S3 bucket CORS settings');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('explains denied and timed-out uploads without confirming them', async () => {
    let file = prepareUpload();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(uploadFile(file, '/intent', () => '/confirm')).rejects.toThrow(
      'S3 write permissions',
    );
    expect(request).toHaveBeenCalledTimes(1);
    file = prepareUpload();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')),
    );
    await expect(uploadFile(file, '/intent', () => '/confirm')).rejects.toThrow('upload timed out');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('confirms only a successful private upload and omits API credentials from storage', async () => {
    const file = prepareUpload();
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await uploadFile(file, '/intent', () => '/confirm');
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      }),
    );
    expect(request).toHaveBeenLastCalledWith('/confirm', { method: 'POST' });
  });
  it('only permits HTTPS AWS storage destinations', () => {
    expect(validateStorageUrl('https://bucket.s3.ap-south-1.amazonaws.com/')).toContain('https:');
    for (const url of [
      'javascript:alert(1)',
      'http://bucket.s3.amazonaws.com',
      'https://amazonaws.com.attacker.example',
      'https://attacker.example',
      'https://user:pass@bucket.s3.amazonaws.com',
    ])
      expect(() => validateStorageUrl(url)).toThrow();
  });
  it('rejects SVG and mismatched photo types', () => {
    expect(() =>
      validatePhoto(new File(['<svg>payload</svg>'], 'photo.svg', { type: 'image/svg+xml' })),
    ).toThrow();
    expect(() =>
      validatePhoto(new File(['abcdefghijkl'], 'photo.jpg', { type: 'image/png' })),
    ).toThrow();
    expect(() =>
      validatePhoto(new File(['abcdefghijkl'], 'photo.png', { type: 'image/png' })),
    ).not.toThrow();
  });
});
