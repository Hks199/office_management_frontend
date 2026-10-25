import { MapPin } from 'lucide-react';

export function GpsRequired({
  error,
  disabled,
  pending = false,
  onRetry,
}: {
  error?: string;
  disabled: boolean;
  pending?: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="gps-required" role="group" aria-label="Enable GPS">
      <h4>
        <MapPin size={20} />
        Turn on GPS to continue
      </h4>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <p>
        Attendance needs a fresh location. Enable your device's Location / GPS setting, then allow
        location access for this website.
      </p>
      <button type="button" className="button" autoFocus disabled={disabled} onClick={onRetry}>
        <MapPin size={16} />
        {pending ? 'Getting location…' : 'Enable GPS and continue'}
      </button>
      {pending && (
        <p role="status">Checking GPS. Allow location access in your browser when prompted.</p>
      )}
      <p className="field-hint">
        This button requests browser location access. Your device's GPS switch must be enabled in
        device settings. The camera opens only after a location is received.
      </p>
      <details>
        <summary>How to enable GPS</summary>
        <ol>
          <li>Open your device settings and turn on Location / Location Services.</li>
          <li>Allow location for your browser and enable precise location if available.</li>
          <li>In the browser's permissions for this website, set Location to Allow.</li>
          <li>
            Return here. Location is checked again automatically, or press Enable GPS and continue.
          </li>
        </ol>
      </details>
    </div>
  );
}
