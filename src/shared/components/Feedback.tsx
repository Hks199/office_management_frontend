import { AlertCircle, Inbox, LoaderCircle, RotateCw } from 'lucide-react';
import { errorMessage } from '../lib/api';
export function Loading({ text = 'Loading your workspace…' }: { text?: string }) {
  return (
    <div className="state" role="status">
      <LoaderCircle className="animate-spin" size={24} />
      <span>{text}</span>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>We couldn’t complete that</strong>
        <p>{errorMessage(error)}</p>
        {retry && (
          <button className="button secondary small" onClick={retry}>
            <RotateCw size={14} />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function EmptyState({
  title = 'No records yet',
  description = 'Records in your permitted scope will appear here.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="state">
      <div className="empty-icon">
        <Inbox size={28} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
