# Attendance camera, GPS and private S3 storage

Open Attendance → Mark attendance. The app reads your current attendance status from the backend and shows only Check in if you have not checked in, or only Check out if you have an open attendance record. Completed attendance shows a completion message. Open records older than 24 hours require an authorized correction, matching the backend's existing rules. There is no manual action selector.

1. Press the displayed Check in or Check out action. A Turn on GPS popup appears immediately, before any location request. Press Enable GPS and continue to request location access. If location services are off or permission is denied, the popup stays visible with instructions and a retry button. Camera access is not requested until a valid location is available.
2. Once GPS is ready, the camera opens automatically. Allow camera access, frame the preview, press Capture photo and review the captured image. Retake photo refreshes GPS before opening the camera again. No microphone access is requested. Camera permission failures have a retry control.
3. Press Confirm check in or Confirm check out. The app obtains a fresh GPS position, uploads the captured JPEG privately, confirms it with the API, then saves attendance. Confirmation requires both GPS and a captured photo; the initial action never saves an incomplete record.

The camera stops after capture, when explicitly stopped, or when the dialog closes. Captured image previews are released when replaced or closed. There is no continuous location tracking. Camera and location require HTTPS in deployment; localhost works for development. A browser cannot turn on the device's operating-system location switch automatically. Denied permissions must be enabled in the browser's site settings.

The Turn on GPS popup is a foreground modal, shown on every attendance attempt even if browser permission was previously granted. It no longer waits for a GPS error or a timeout. Repeated acquisition failures keep this popup visible. Clicking Enable GPS and continue requests a fresh browser location; returning from device settings after an error also triggers a fresh check. The browser controls native permission prompts and may remember an earlier allow/deny choice. The web app cannot reset that choice or toggle hardware GPS. Location is checked again at confirmation; if it becomes unavailable, the GPS popup reappears and photo upload and attendance submission stay blocked until GPS succeeds and a new photo is captured.

## Configure the backend later

Add your actual values to `D:\sunvika\office_management_backend\.env`, then restart the backend. Keep them out of the frontend `.env` and out of version control.

```dotenv
AWS_REGION=your-bucket-region
S3_BUCKET=your-private-bucket-name
# For local development when an IAM role or AWS profile is not available:
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
# Required only when using temporary credentials:
# AWS_SESSION_TOKEN=your-session-token
```

The backend uses the AWS SDK credential chain, so a configured IAM role or AWS profile can supply credentials instead of static keys. No AWS credentials are sent to the browser. An empty or unconfigured storage setup returns a clear API error; attendance is not saved before the upload is confirmed.

The existing backend S3 adapter requires bucket versioning, default encryption and all four S3 Block Public Access settings. Allow your exact frontend origin in bucket CORS with POST for upload and GET/HEAD for photo access. For local development that origin is `http://localhost:5173`; configure your actual HTTPS origin for deployment. The backend's `infra/private-photos.yaml` contains a bucket and scoped runtime/cleanup IAM policy template; `PHASE4.md` documents the storage contract. Ensure the backend identity has the template's required bucket-configuration read and object permissions.

## Storage and persistence

`GET /api/v1/attendance/me/status` supplies the authenticated employee's valid next action. It checks open attendance across month boundaries and today's Kolkata business date; it does not depend on the table's history filters. A status-loading error blocks actions until a successful retry.

- `POST /api/v1/files/upload-intents` authorizes a short-lived, size/type/checksum-constrained S3 POST for the signed-in employee.
- The browser uploads the captured JPEG to that S3 destination without API authorization headers or cookies.
- `POST /api/v1/files/:id/confirm` verifies size, MIME, checksum, image signature and immutable S3 object version.
- `POST /api/v1/attendance/check-in` or `/check-out` saves the photo file ID, actual client capture timestamp, latitude, longitude and accuracy. The server assigns the employee and authoritative attendance timestamp.
- MongoDB stores `checkInLocation` / `checkOutLocation` and `checkInPhotoFileId` / `checkOutPhotoFileId`. File metadata holds the private S3 reference; image bytes remain in S3.

Existing backend ownership, permission, attendance uniqueness and photo attachment checks apply. Private evidence can be viewed through the existing authorized attendance photo endpoints.

## Verification boundary

Browser integration tests use the real backend with a temporary MongoDB replica set, Chromium's simulated camera/GPS, and an intercepted S3 destination. They check JPEG capture, upload/confirmation, persisted current coordinates, check-in/check-out, permission-denial messages and camera shutdown. Live AWS upload, IAM/CORS and physical-device permissions require validation after configuration.
