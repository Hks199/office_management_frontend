import { validatePhoto } from '../../shared/lib/uploads';

export function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Camera permission was denied. Allow camera access in your browser site settings, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return 'No compatible camera was found. Connect a camera and try again.';
  if (name === 'NotSupportedError')
    return 'Camera capture is not supported by this browser. Try a browser with camera support.';
  if (name === 'NotReadableError' || name === 'AbortError')
    return 'The camera is unavailable or in use by another application. Close that application and try again.';
  return error instanceof Error
    ? error.message
    : 'The camera could not be opened. Please try again.';
}

export async function capturePhoto(video: HTMLVideoElement) {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight)
    throw new Error('Wait for the live camera preview before capturing your photo.');
  const capturedAt = new Date().toISOString();
  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo capture is not supported in this browser.');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (value) resolve(value);
        else reject(new Error('Photo capture failed. Please retake your photo.'));
      },
      'image/jpeg',
      0.88,
    );
  });
  const file = new File([blob], 'attendance-photo.jpg', { type: 'image/jpeg' });
  validatePhoto(file);
  return { file, capturedAt };
}
