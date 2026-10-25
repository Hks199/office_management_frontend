import { useState, type FormEvent } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Modal } from '../../shared/components/Modal';
import { FormField } from '../../shared/components/DynamicForm';
import { errorMessage, request } from '../../shared/lib/api';
import { uploadFile } from '../../shared/lib/uploads';
import { label } from '../../shared/lib/format';
import type { RecordData } from '../../shared/types/api';
import {
  customerWorkbookSheets,
  prepareCustomerFile,
  validateCustomerFile,
} from './customer-import-file';
const defaultMapping = {
  customerName: 'Contact Name',
  mobileNumber: 'Mobile Number',
  alternateNumber: 'Alternate Number',
  state: 'State',
  district: 'District',
  block: 'Block/Tehsil',
  siteAddress: 'Site Address',
  remarks: 'Remarks',
};
export function ImportUpload({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (job: RecordData) => void;
}) {
  const [file, setFile] = useState<File>();
  const [branchId, setBranchId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>(defaultMapping);
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheetName, setSheetName] = useState('');
  async function chooseFile(selected?: File) {
    setError('');
    setFile(undefined);
    setSheets([]);
    setSheetName('');
    if (!selected) return;
    setBusy(true);
    try {
      validateCustomerFile(selected);
      if (!/\.csv$/i.test(selected.name)) {
        const names = await customerWorkbookSheets(selected);
        setSheets(names);
        setSheetName(names[0]);
      }
      setFile(selected);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      validateCustomerFile(file);
      if (!branchId) throw new Error('Select a branch.');
      const columnMapping = Object.fromEntries(
        Object.entries(mapping)
          .map(([key, value]) => [key, value.trim()])
          .filter(([, value]) => value),
      );
      if (new Set(Object.values(columnMapping)).size !== Object.values(columnMapping).length)
        throw new Error('Each column must map to only one contact field.');
      const prepared = await prepareCustomerFile(file, sheetName);
      const fileId = await uploadFile(
        prepared,
        '/csv-imports/upload-intents',
        (id) => `/csv-imports/files/${id}/confirm`,
      );
      const result = await request<RecordData>('/csv-imports', {
        method: 'POST',
        body: { fileId, branchId, columnMapping },
      });
      onSaved(result.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Import contacts" onClose={onClose} busy={busy}>
      <p className="form-note">
        Upload CSV or Excel (.xlsx or .xls), up to 20 MB and 50,000 contacts. For Excel, choose one
        worksheet. Review the preview before confirming and assigning contacts.
      </p>
      <a className="text-button" href="/contact-import-template.csv" download>
        Download CSV template
      </a>
      <a className="text-button" href="/contact-import-template.xlsx" download>
        Download Excel template
      </a>
      <p className="form-note">
        Put column headers in the first row. Enter 10-digit Indian phone numbers (for example
        9876543210); +91 is added automatically. Other countries require their country code. Use
        existing state and district names or codes. Block/Tehsil is optional; if provided, it must
        already exist under the district. Paste formula results as values and unmerge cells before
        uploading.
      </p>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <FormField
          field={{ name: 'branchId', lookup: '/branches', required: true }}
          value={branchId}
          values={{}}
          disabled={busy}
          onChange={(value) => setBranchId(String(value))}
        />
        <label className="file-input">
          <FileSpreadsheet size={28} />
          <strong>Choose CSV or Excel file</strong>
          <span>UTF-8 CSV, XLSX or XLS · Up to 20 MB</span>
          <input
            aria-label="Contact CSV or Excel file"
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            required
            disabled={busy}
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
        </label>
        <label className="field">
          <span>
            <input
              type="checkbox"
              checked={!mapping.block}
              disabled={busy}
              onChange={(event) =>
                setMapping((previous) => ({
                  ...previous,
                  block: event.target.checked ? '' : defaultMapping.block,
                }))
              }
            />{' '}
            Skip optional Block/Tehsil column
          </span>
          <span className="field-hint">
            When selected, block values in the file are ignored and contacts have no block
            assignment. State and district are still required.
          </span>
        </label>
        {file && <p className="form-note">Selected file: {file.name}</p>}
        {sheets.length > 0 && (
          <label className="field">
            Excel worksheet
            <select
              value={sheetName}
              onChange={(event) => setSheetName(event.target.value)}
              disabled={busy}
            >
              {sheets.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        <details>
          <summary>Column mapping</summary>
          <p className="form-note">
            Match each contact field to an exact header in your file. Clear optional mappings for
            columns your file does not contain. The name column also accepts the older “Customer
            Name” header.
          </p>
          <div className="form-grid">
            {Object.keys(defaultMapping).map((key) => (
              <label className="field" key={key}>
                {label(key)}
                <input
                  value={mapping[key]}
                  maxLength={100}
                  disabled={busy}
                  required={[
                    'customerName',
                    'mobileNumber',
                    'state',
                    'district',
                    'siteAddress',
                  ].includes(key)}
                  onChange={(event) =>
                    setMapping((previous) => ({ ...previous, [key]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </details>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="button" disabled={busy || !file}>
            {busy ? 'Processing file…' : 'Upload & validate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
