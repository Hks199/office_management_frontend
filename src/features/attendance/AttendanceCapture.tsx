import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Camera, MapPin, RefreshCw } from 'lucide-react';
import { Modal } from '../../shared/components/Modal';
import { errorMessage, request } from '../../shared/lib/api';
import { getLocation, uploadFile, validatePhoto } from '../../shared/lib/uploads';
import { capturePhoto, cameraError } from './camera';
import { GpsRequired } from './GpsRequired';

type Location = Awaited<ReturnType<typeof getLocation>>;
type Props = { onClose: () => void; onSaved: () => void };
const statusSchema = z.object({
  action: z.enum(['check-in', 'check-out']).nullable(),
  message: z.string(),
});

export function AttendanceCapture(props: Props) {
  const status = useQuery({
    queryKey: ['attendance', 'self-status'],
    queryFn: async () => statusSchema.parse((await request('/attendance/me/status')).data),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  if (!status.isFetching && status.data?.action && !status.error) {
    return <AttendanceSession {...props} kind={status.data.action} message={status.data.message} />;
  }
  return (
    <Modal title="Mark attendance" onClose={props.onClose}>
      {status.isFetching ? (
        <p role="status">Checking your attendance…</p>
      ) : status.error ? (
        <>
          <p role="alert" className="inline-error">
            {errorMessage(status.error)}
          </p>
          <button className="button secondary" onClick={() => void status.refetch()}>
            Try again
          </button>
        </>
      ) : (
        <p role="status">{status.data?.message}</p>
      )}
    </Modal>
  );
}

function AttendanceSession({
  onClose,
  onSaved,
  kind,
  message,
}: Props & {
  kind: 'check-in' | 'check-out';
  message: string;
}) {
  const [photo, setPhoto] = useState<{ file: File; capturedAt: string }>();
  const [preview, setPreview] = useState('');
  const [location, setLocation] = useState<Location>();
  const [started, setStarted] = useState(false);
  const [locating, setLocating] = useState(false);
  const [openingCamera, setOpeningCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [cameraIssue, setCameraIssue] = useState('');
  const [step, setStep] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const activeStream = useRef<MediaStream | undefined>(undefined);
  const mounted = useRef(false);
  const previewUrl = useRef('');
  const uploaded = useRef<{ file: File; id: string } | undefined>(undefined);
  const deviceRequestPending = useRef(false);
  const resumeGps = useEffectEvent(() => {
    if (started && locationError && !location && !busy && !locating && !openingCamera) void begin();
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeStream.current?.getTracks().forEach((track) => track.stop());
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);
  useEffect(() => {
    if (video.current && stream) video.current.srcObject = stream;
  }, [stream]);
  useEffect(() => {
    const onFocus = () => {
      resumeGps();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') resumeGps();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  function stopCamera() {
    activeStream.current?.getTracks().forEach((track) => track.stop());
    activeStream.current = undefined;
    setStream(undefined);
    setCameraReady(false);
  }
  function clearPreview() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = '';
    setPreview('');
  }
  async function openCamera() {
    if (!mounted.current) return;
    setCameraIssue('');
    setOpeningCamera(true);
    try {
      if (!window.isSecureContext) throw new Error('Camera access requires HTTPS or localhost.');
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          'A camera is not available in this browser. Use a device with camera support.',
        );
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      if (!mounted.current) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      activeStream.current = next;
      setStream(next);
      setCameraReady(false);
      setPhoto(undefined);
      clearPreview();
      uploaded.current = undefined;
    } catch (err) {
      if (mounted.current) setCameraIssue(cameraError(err));
    } finally {
      if (mounted.current) setOpeningCamera(false);
    }
  }
  async function begin() {
    if (deviceRequestPending.current || locating || openingCamera || busy) return;
    deviceRequestPending.current = true;
    setStarted(true);
    setLocationError('');
    setCameraIssue('');
    setError('');
    setLocation(undefined);
    setPhoto(undefined);
    clearPreview();
    uploaded.current = undefined;
    stopCamera();
    setLocating(true);
    try {
      const current = await getLocation();
      if (!mounted.current) return;
      setLocation(current);
      setLocating(false);
      // Camera permission is requested only after GPS succeeds.
      await openCamera();
    } catch (err) {
      if (mounted.current) setLocationError(errorMessage(err));
    } finally {
      deviceRequestPending.current = false;
      if (mounted.current) setLocating(false);
    }
  }
  async function takePhoto() {
    if (!video.current || !location) return;
    setBusy(true);
    setError('');
    try {
      const captured = await capturePhoto(video.current);
      if (mounted.current) {
        setPhoto(captured);
        clearPreview();
        previewUrl.current = URL.createObjectURL(captured.file);
        setPreview(previewUrl.current);
        uploaded.current = undefined;
        stopCamera();
      }
    } catch (err) {
      if (mounted.current) setError(errorMessage(err));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || locating || openingCamera) return;
    if (!started) {
      setStarted(true);
      return;
    }
    if (!photo || !location) return;
    setBusy(true);
    setError('');
    try {
      validatePhoto(photo.file);
      setStep('Refreshing your current GPS location…');
      let current: Location;
      try {
        current = await getLocation();
      } catch (err) {
        setLocation(undefined);
        setLocationError(errorMessage(err));
        return;
      }
      if (!mounted.current) return;
      setLocation(current);
      setStep('Uploading your private photo…');
      let photoFileId = uploaded.current?.file === photo.file ? uploaded.current.id : undefined;
      if (!photoFileId) {
        photoFileId = await uploadFile(
          photo.file,
          '/files/upload-intents',
          (id) => '/files/' + id + '/confirm',
          {
            contentType: photo.file.type,
            purpose: kind === 'check-in' ? 'ATTENDANCE_CHECK_IN' : 'ATTENDANCE_CHECK_OUT',
          },
        );
        uploaded.current = { file: photo.file, id: photoFileId };
      }
      setStep('Saving attendance and GPS coordinates…');
      await request('/attendance/' + kind, {
        method: 'POST',
        body: { photoFileId, capturedAt: photo.capturedAt, location: current },
      });
      onSaved();
    } catch (err) {
      if (mounted.current) setError(errorMessage(err));
    } finally {
      if (mounted.current) {
        setBusy(false);
        setStep('');
      }
    }
  }
  const action = kind === 'check-in' ? 'Check in' : 'Check out';
  if (started && !location) {
    return (
      <Modal key="gps-required" title="Turn on GPS" onClose={onClose} busy={busy}>
        <GpsRequired
          error={locationError}
          pending={locating}
          disabled={busy || locating || openingCamera}
          onRetry={() => void begin()}
        />
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title="Mark attendance" onClose={onClose} busy={busy}>
      <p className="form-note">{message}</p>
      <form onSubmit={(event) => void submit(event)} className="form-stack">
        {!started && (
          <p className="field-hint">
            Press {action} to get your current GPS location. Once location is available, your camera
            will open to capture your attendance photo.
          </p>
        )}
        {started && (
          <section className="attendance-evidence" aria-label="GPS location">
            <h3>
              <MapPin size={18} />
              1. Current location
            </h3>
            {locating && (
              <p role="status">Getting GPS location. Allow location access when prompted…</p>
            )}
            {location && (
              <p className="attendance-location" role="status">
                GPS ready · Latitude {location.latitude.toFixed(6)} · Longitude{' '}
                {location.longitude.toFixed(6)} · Accuracy ±{Math.round(location.accuracyMeters)} m
              </p>
            )}
          </section>
        )}
        {started && location && (
          <section className="attendance-evidence" aria-label="Camera photo">
            <h3>
              <Camera size={18} />
              2. Attendance photo
            </h3>
            {openingCamera && (
              <p role="status">Opening camera. Allow camera access when prompted…</p>
            )}
            {stream ? (
              <>
                <video
                  ref={video}
                  className="attendance-camera"
                  aria-label="Live camera preview"
                  autoPlay
                  muted
                  playsInline
                  onCanPlay={() => setCameraReady(true)}
                  onError={() => {
                    stopCamera();
                    setCameraIssue('Camera preview failed. Try the camera again.');
                  }}
                />
                <div className="attendance-controls">
                  <button
                    type="button"
                    className="button"
                    disabled={busy || !cameraReady}
                    onClick={() => void takePhoto()}
                  >
                    <Camera size={16} />
                    Capture photo
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={stopCamera}
                  >
                    Stop camera
                  </button>
                </div>
              </>
            ) : (
              <>
                {photo && preview && (
                  <img
                    className="attendance-camera"
                    src={preview}
                    alt="Your captured attendance photo"
                  />
                )}
                {!openingCamera && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={() => void begin()}
                  >
                    {photo ? <RefreshCw size={16} /> : <Camera size={16} />}
                    {photo ? 'Retake photo' : 'Try camera again'}
                  </button>
                )}
                {photo && <p className="field-hint">Photo captured. The camera is now off.</p>}
              </>
            )}
            {cameraIssue && (
              <p className="inline-error" role="alert">
                {cameraIssue}
              </p>
            )}
          </section>
        )}
        {photo && location && (
          <p className="field-hint">
            Confirm to save your photo privately and record your current latitude and longitude.
          </p>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {step && <p role="status">{step}</p>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="button"
            disabled={busy || locating || openingCamera || (started && (!photo || !location))}
          >
            {busy
              ? 'Saving…'
              : started
                ? kind === 'check-in'
                  ? 'Confirm check in'
                  : 'Confirm check out'
                : action}
          </button>
        </div>
      </form>
    </Modal>
  );
}
