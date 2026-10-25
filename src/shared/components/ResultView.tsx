import type { RecordData } from '../types/api';
import { display, label, recordId } from '../lib/format';
import { EmptyState } from './Feedback';
import { recordDisplayFields, recordFieldLabel, recordFieldValue } from '../lib/record-display';
import { useDisplayRecords } from '../lib/use-display-records';

// Render nested report sections without flattening arrays into unreadable text.
export function ResultView({ data: source }: { data: unknown }) {
  const data = useDisplayRecords(source);
  if (Array.isArray(data)) {
    if (!data.length) return <EmptyState title="No results for these filters" />;
    const records = data.map<RecordData>((value) => {
      if (!value || typeof value !== 'object') return { value };
      const record = value as RecordData;
      return {
        ...(record._id && typeof record._id === 'object'
          ? (record._id as RecordData)
          : typeof record._id === 'string' && !/^[a-f\d]{24}$/i.test(record._id)
            ? { group: record._id }
            : {}),
        ...record,
      };
    });
    const keys = [
      ...new Set(
        records.flatMap((record) => recordDisplayFields(record).map((field) => field.key)),
      ),
    ];
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {keys.map((key) => (
                <th key={key}>{recordFieldLabel(key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => (
              <tr key={typeof record._id === 'object' ? index : recordId(record) || index}>
                {keys.map((key) => (
                  <td key={key}>{recordFieldValue(record, key)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (!data || typeof data !== 'object') return <p>{display(data)}</p>;
  const visible = new Set(recordDisplayFields(data as RecordData).map((field) => field.key));
  const entries = Object.entries(data as RecordData).filter(([key]) => visible.has(key));
  const scalar = entries.filter(([, value]) => value === null || typeof value !== 'object');
  const nested = entries.filter(([, value]) => value !== null && typeof value === 'object');
  return (
    <div className="result-sections">
      {scalar.length > 0 && (
        <dl className="record-details">
          {scalar.map(([key]) => (
            <div key={key}>
              <dt>{recordFieldLabel(key)}</dt>
              <dd>{recordFieldValue(data as RecordData, key)}</dd>
            </div>
          ))}
        </dl>
      )}
      {nested.map(([key, value]) => (
        <section key={key}>
          <h3>{label(key)}</h3>
          <ResultView data={value} />
        </section>
      ))}
    </div>
  );
}
