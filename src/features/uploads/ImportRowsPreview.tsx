import type { RecordData } from '../../shared/types/api';
import { display, label } from '../../shared/lib/format';

function issues(row: RecordData): string[] {
  const details = Array.isArray(row.rowIssues) ? row.rowIssues : [];
  const messages = details.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object' || !('field' in item) || !('code' in item)) return [];
    const field = String(item.field);
    const name = field === 'block' ? 'Block/Tehsil' : label(field);
    return [
      item.code === 'NOT_FOUND_OR_AMBIGUOUS'
        ? `${name} must match one active configured location under its parent. ${field === 'block' ? 'Create the block first, leave the cell blank, or select Skip optional Block/Tehsil column when uploading again.' : 'Use an existing location name or code.'}`
        : `${name} is missing or invalid. Correct this field and upload again.`,
    ];
  });
  if (messages.length) return messages;
  const codes = Array.isArray(row.rowErrors) ? row.rowErrors.map(String) : [];
  if (codes.includes('INVALID_LOCATION'))
    return [
      'State, district or Block/Tehsil does not match an active configured location. Block/Tehsil is optional: leave it blank or skip its column when uploading again.',
    ];
  if (codes.includes('INVALID_CUSTOMER_ROW'))
    return [
      'Contact details are missing or invalid. Check the name, mobile number and site address.',
    ];
  if (codes.some((code) => code.includes('DUPLICATE')))
    return [
      'This mobile number is already present in the file or contact list under the configured duplicate policy.',
    ];
  return codes.length
    ? codes.map(label)
    : [row.status === 'IMPORTED' ? 'Imported' : 'Ready to import'];
}
export function ImportRowsPreview({ data }: { data: unknown }) {
  const rows = Array.isArray(data)
    ? data.filter((row): row is RecordData => row !== null && typeof row === 'object')
    : [];
  if (!rows.length) return <p className="form-note">No preview rows are available.</p>;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>File row</th>
            <th>Status</th>
            <th>Contact</th>
            <th>State</th>
            <th>District</th>
            <th>Block/Tehsil</th>
            <th>Validation result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const input =
              row.inputLocation && typeof row.inputLocation === 'object'
                ? (row.inputLocation as RecordData)
                : {};
            const normalized =
              row.normalizedData && typeof row.normalizedData === 'object'
                ? (row.normalizedData as RecordData)
                : {};
            return (
              <tr key={String(row._id ?? row.rowNumber ?? index)}>
                <td>{display(row.rowNumber)}</td>
                <td>{label(String(row.status ?? 'Unknown'))}</td>
                <td>{display(normalized.customerName)}</td>
                <td>{display(input.state)}</td>
                <td>{display(input.district)}</td>
                <td>{display(input.block)}</td>
                <td>
                  {issues(row).map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
