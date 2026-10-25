import { useState } from 'react';
import { Check, Users, X } from 'lucide-react';
import type { RecordData } from '../types/api';
import { recordId } from '../lib/format';
import { useDisplayRecords } from '../lib/use-display-records';

export function ReportingManagerPicker({
  controlId,
  selected,
  records,
  initialLabels,
  disabled,
  loading,
  error,
  enabled,
  labelFor,
  onChange,
}: {
  controlId: string;
  selected: string[];
  records: RecordData[];
  initialLabels: Record<string, string>;
  disabled?: boolean;
  loading: boolean;
  error: boolean;
  enabled: boolean;
  labelFor: (record: RecordData) => string;
  onChange: (ids: string[]) => void;
}) {
  const [cachedLabels, setCachedLabels] = useState<Record<string, string>>({});
  const resolved = useDisplayRecords(selected.map((id) => ({ employeeId: id })));
  const managerLabel = (id: string) => {
    const record = records.find((item) => recordId(item) === id);
    if (record) return labelFor(record);
    if (cachedLabels[id] || initialLabels[id]) return cachedLabels[id] ?? initialLabels[id];
    const reference = resolved[selected.indexOf(id)] as RecordData | undefined;
    return typeof reference?.employeeName === 'string'
      ? `${reference.employeeName}${reference.employeeCode ? ` (${String(reference.employeeCode)})` : ''}`
      : 'Selected manager — name unavailable';
  };
  return (
    <div
      id={controlId}
      role="group"
      aria-labelledby={`${controlId}-label`}
      className="manager-picker"
    >
      <div className="manager-selection-heading">
        <span aria-live="polite">
          <Users size={16} aria-hidden="true" /> {selected.length} of 10 selected
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            className="text-button"
            disabled={disabled || !enabled}
            onClick={() => onChange([])}
          >
            Clear all
          </button>
        )}
      </div>
      <div className="manager-selected" aria-label="Selected reporting managers">
        {selected.length ? (
          selected.map((id) => (
            <span key={id} className="manager-chip">
              <Check size={14} aria-hidden="true" />
              <span>{managerLabel(id)}</span>
              <button
                type="button"
                aria-label={`Remove ${managerLabel(id)}`}
                disabled={disabled || !enabled}
                onClick={() => onChange(selected.filter((value) => value !== id))}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          ))
        ) : (
          <p>No managers selected. Tick a name below to add them.</p>
        )}
      </div>
      <div
        className="manager-options"
        aria-label="Available reporting managers"
        aria-busy={loading}
      >
        {!enabled ? (
          <p>Choose an employee role first.</p>
        ) : loading ? (
          <p>Loading managers…</p>
        ) : error ? (
          <p>Manager options could not be loaded. Your selections are kept.</p>
        ) : !records.length ? (
          <p>No managers match. Clear your search or check the reporting policy.</p>
        ) : (
          records.map((record) => {
            const id = recordId(record);
            const checked = selected.includes(id);
            return (
              <label key={id} className={`manager-option${checked ? ' is-selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled || (!checked && selected.length >= 10)}
                  onChange={(event) => {
                    setCachedLabels((previous) => ({ ...previous, [id]: labelFor(record) }));
                    onChange(
                      event.target.checked
                        ? [...selected, id]
                        : selected.filter((value) => value !== id),
                    );
                  }}
                />
                <span>{labelFor(record)}</span>
                {checked && <Check size={16} aria-hidden="true" />}
              </label>
            );
          })
        )}
      </div>
      {selected.length >= 10 && (
        <p className="manager-limit" role="status">
          Ten managers selected. Remove one to choose another.
        </p>
      )}
    </div>
  );
}
