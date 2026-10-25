import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import type { Field } from '../../features/resources/config';
import type { RecordData } from '../types/api';
import { errorMessage, request } from '../lib/api';
import { display, label, recordId } from '../lib/format';
import { initialValues, buildPayload } from './form-schema';
import { useAuth } from '../../features/auth/auth-context';
import { employeeFormFields } from '../../features/resources/employee-form';
import { lookupOptions } from '../lib/lookup-options';
import { useDisplayRecords } from '../lib/use-display-records';
import { recordFieldValue } from '../lib/record-display';
import { ReportingManagerPicker } from './ReportingManagerPicker';

function lookupLabel(record: RecordData) {
  return record.firstName
    ? `${display(record.firstName)} ${display(record.lastName)}  ${display(record.employeeCode)}`
    : String(
        record.label ??
          record.name ??
          record.branchName ??
          record.customerName ??
          record.code ??
          'Unnamed option',
      );
}
function Lookup({
  controlId,
  field,
  value,
  values,
  onChange,
  disabled,
}: {
  controlId: string;
  field: Field;
  value: unknown;
  values: RecordData;
  onChange: (value: unknown, record?: RecordData) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [selectionLabels, setSelectionLabels] = useState<Record<string, string>>({});
  const { can } = useAuth();
  const parentValue = field.parent ? values[field.parent] : undefined;
  const enabled = !field.parent || Boolean(parentValue);
  const endpoint = field.lookup ?? '';
  const reference = endpoint.startsWith('/reference-values');
  const params = new URLSearchParams();
  if (!reference) {
    params.set('limit', '100');
    if (term.length >= 2) params.set('search', term);
  }
  if (field.parent && parentValue) params.set(field.parent, String(parentValue));
  const path = `${endpoint}${endpoint.includes('?') ? '&' : '?'}${params}`;
  const query = useQuery({
    queryKey: ['lookup', path],
    queryFn: ({ signal }) => lookupOptions(path, signal),
    enabled,
  });
  const records = Array.isArray(query.data?.data) ? query.data.data : [];
  const selectedLabels = useDisplayRecords({ [field.name]: value });
  const current = Array.isArray(value) ? (value as string[]) : [String(value ?? '')];
  return (
    <div className="lookup-control">
      {!reference && (
        <div className="lookup-search">
          <input
            aria-label={`Search ${field.label ?? label(field.name)}`}
            value={search}
            disabled={disabled || !enabled}
            maxLength={100}
            placeholder="Search options"
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            className="button secondary small"
            disabled={disabled || (search.length > 0 && search.trim().length < 2)}
            type="button"
            onClick={() => setTerm(search.trim())}
          >
            Find
          </button>
          {field.name === 'reportingManagerIds' && (search || term) && (
            <button
              type="button"
              className="text-button"
              disabled={disabled || !enabled}
              onClick={() => {
                setSearch('');
                setTerm('');
              }}
            >
              Clear search
            </button>
          )}
        </div>
      )}
      {field.name === 'reportingManagerIds' ? (
        <ReportingManagerPicker
          controlId={controlId}
          selected={current.filter(Boolean)}
          records={records}
          initialLabels={(values._reportingManagerLabels ?? {}) as Record<string, string>}
          disabled={disabled}
          enabled={enabled}
          loading={query.isPending}
          error={query.isError}
          labelFor={lookupLabel}
          onChange={onChange}
        />
      ) : (
        <select
          id={controlId}
          multiple={field.type === 'multi-lookup'}
          value={field.type === 'multi-lookup' ? current : current[0]}
          required={field.required}
          disabled={disabled || !enabled || query.isPending || query.isError}
          onChange={(event) => {
            const next =
              field.type === 'multi-lookup'
                ? Array.from(event.target.selectedOptions, (option) => option.value)
                : event.target.value;
            const chosen = Array.isArray(next) ? next : [next];
            setSelectionLabels((previous) => ({
              ...previous,
              ...Object.fromEntries(
                chosen.flatMap((selected) => {
                  const record = records.find(
                    (item) => (reference ? String(item.code) : recordId(item)) === selected,
                  );
                  return record ? [[selected, lookupLabel(record)]] : [];
                }),
              ),
            }));
            onChange(
              next,
              typeof next === 'string'
                ? records.find((record) => recordId(record) === next)
                : undefined,
            );
          }}
        >
          {field.type !== 'multi-lookup' && (
            <option value="">
              {!enabled
                ? `Choose ${label(field.parent ?? '')} first`
                : query.isPending
                  ? 'Loading options'
                  : field.nullable
                    ? 'None'
                    : 'Select an option'}
            </option>
          )}
          {current
            .filter(
              (selected) =>
                selected &&
                !records.some(
                  (record) => (reference ? record.code : recordId(record)) === selected,
                ),
            )
            .map((selected) => (
              <option key={selected} value={selected}>
                {selectionLabels[selected] ?? recordFieldValue(selectedLabels, field.name)} (current
                selection)
              </option>
            ))}
          {records.map((record) => (
            <option
              key={recordId(record)}
              value={reference ? String(record.code) : recordId(record)}
            >
              {lookupLabel(record)}
            </option>
          ))}
        </select>
      )}
      {query.isError && (
        <span className="inline-error">
          {errorMessage(query.error)}{' '}
          <button className="text-button" type="button" onClick={() => void query.refetch()}>
            Retry
          </button>
        </span>
      )}
      {query.isSuccess && !records.length && endpoint === '/telecaller-reports/contact-options' && (
        <span className="field-hint" role="status">
          {term
            ? 'No Available or Interested contacts match this search within your access scope.'
            : 'No assigned Available or Interested contacts are available within your access scope. Ask your manager to check contact assignments and statuses.'}
        </span>
      )}
      {query.isSuccess &&
        !records.length &&
        endpoint.startsWith('/csv-imports/') &&
        endpoint.endsWith('/assignees') && (
          <span className="inline-error" role="status">
            No eligible Telecallers found. Clear the search or ask your administrator to check
            active Telecallers, their branch and assignment permissions.
          </span>
        )}
      {query.isSuccess && !records.length && endpoint.startsWith('/employees/role-options') && (
        <span className="field-hint">
          {query.data.meta?.policyReviewRequired
            ? 'Role permissions have changed. The MD must review and save the affected employee creation policies before these roles can be selected.'
            : 'No approved roles match. Clear the search or ask the MD to check active roles and employee creation policies.'}
          {can('policies:manage') && (
            <>
              {' '}
              <Link to="/policies">Review creation policies</Link>.
            </>
          )}
        </span>
      )}
      {query.isSuccess &&
        records.length > 0 &&
        endpoint.startsWith('/employees/role-options') &&
        query.data.meta?.policyReviewRequired && (
          <span className="field-hint">
            Some roles need creation policy review after permission changes.
            {can('policies:manage') && (
              <>
                {' '}
                <Link to="/policies">Review creation policies</Link>.
              </>
            )}
          </span>
        )}
      {query.isSuccess &&
        !records.length &&
        endpoint.startsWith('/leads/') &&
        endpoint.endsWith('/assignees') && (
          <span className="inline-error" role="status">
            No eligible sales executives found in this lead’s receiving branch. Clear the search or
            ask an authorized administrator to check active executives, their branch and assignment
            permissions.
          </span>
        )}
      {query.isSuccess &&
        !records.length &&
        (endpoint === '/branches' || endpoint === '/employees/branch-options') &&
        field.name === 'branchId' &&
        field.required && (
          <span className="inline-error" role="status">
            {term
              ? 'No branches match this search. Clear the search or try another branch.'
              : 'No primary branches are available to your account for this role. Ask the MD to check active branches, your branch assignment and the role creation policy.'}
          </span>
        )}
      {query.isSuccess && endpoint === '/leads/branch-options' && !records.length && (
        <span className="field-hint" role="status">
          {term
            ? 'No active branches match this search. Clear the search to see all active branches.'
            : 'No active receiving branches are available.'}
        </span>
      )}
      {endpoint !== '/leads/branch-options' && query.data?.meta && query.data.meta.total > 100 && (
        <span className="field-hint">
          Showing the first 100 matches. Search to find a specific record.
        </span>
      )}
    </div>
  );
}
function GrantPicker({
  value,
  onChange,
  disabled,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  const { user, can } = useAuth();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['permissions'],
    queryFn: ({ signal }) => request<RecordData[]>('/permissions', { signal }),
    enabled: can('permissions:read'),
  });
  const selected = Array.isArray(value)
    ? (value as { permissionId?: string; permission?: string; scope: string }[])
    : [];
  const definitions = query.data?.data ?? [];
  if (!can('permissions:read', 'permissions:assign'))
    return (
      <p className="notice">
        You need permission-read and permission-assignment access to edit grants.
      </p>
    );
  return (
    <div className="grant-picker">
      <input
        aria-label="Search permissions"
        placeholder="Filter permissions"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {query.isError && <p className="inline-error">{errorMessage(query.error)}</p>}
      {query.isPending && <p>Loading permissions</p>}
      <div className="grant-list">
        {definitions
          .filter((definition) => String(definition.code).includes(search.toLowerCase()))
          .map((definition) => {
            const permissionId = recordId(definition);
            const code = String(definition.code);
            return (
              <div className="grant-row" key={permissionId}>
                <strong>{code}</strong>
                <div>
                  {(definition.allowedScopes as string[]).map((scope) => {
                    const checked = selected.some(
                      (grant) =>
                        (grant.permissionId === permissionId || grant.permission === code) &&
                        grant.scope === scope,
                    );
                    const held = user?.grants.some(
                      (grant) =>
                        grant.permission === code &&
                        (grant.scope === 'ALL' ||
                          grant.scope === scope ||
                          (grant.scope === 'REPORTING_SUBTREE' && scope === 'DIRECT_REPORTS')),
                    );
                    const allowed =
                      held &&
                      (!(definition.sensitive || scope === 'ALL') ||
                        can('permissions:delegate_sensitive'));
                    return (
                      <label key={scope} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled || !allowed}
                          onChange={(event) => {
                            const next = selected.filter(
                              (grant) =>
                                !(
                                  (grant.permissionId === permissionId ||
                                    grant.permission === code) &&
                                  grant.scope === scope
                                ),
                            );
                            onChange(
                              event.target.checked ? [...next, { permissionId, scope }] : next,
                            );
                          }}
                        />
                        {label(scope)}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
export function FormField({
  field,
  value,
  values,
  onChange,
  disabled,
}: {
  field: Field;
  value: unknown;
  values: RecordData;
  onChange: (value: unknown, record?: RecordData) => void;
  disabled?: boolean;
}) {
  const controlId = useId();
  const title = field.label ?? label(field.name.split('.').at(-1) ?? field.name);
  if (field.type === 'boolean')
    return (
      <label className="checkbox-label field-checkbox">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
        />
        {title}
      </label>
    );
  if (field.type === 'grants')
    return (
      <fieldset className="full-width">
        <legend>{title}</legend>
        <GrantPicker value={value} onChange={onChange} disabled={disabled} />
      </fieldset>
    );
  const props = {
    id: controlId,
    name: field.name,
    required: field.required,
    disabled,
    value: String(value ?? ''),
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
  };
  return (
    <div className={`field ${field.type === 'textarea' ? 'full-width' : ''}`}>
      <label id={`${controlId}-label`} htmlFor={controlId}>
        {title}
        {field.required && (
          <span className="required" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {field.lookup ? (
        <Lookup
          controlId={controlId}
          field={field}
          value={value}
          values={values}
          onChange={onChange}
          disabled={disabled}
        />
      ) : field.type === 'select' ? (
        <select {...props}>
          <option value="">Select an option</option>
          {field.options?.map((option) => (
            <option key={option} value={option} disabled={field.disabledOptions?.includes(option)}>
              {field.name === 'isActive'
                ? option === 'true'
                  ? 'Active'
                  : 'Inactive'
                : label(option)}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea {...props} minLength={field.min} maxLength={field.max} rows={3} />
      ) : (
        <input
          {...props}
          type={field.type ?? 'text'}
          pattern={field.pattern}
          minLength={field.type !== 'number' ? field.min : undefined}
          maxLength={field.type !== 'number' ? field.max : undefined}
          min={field.type === 'number' ? field.min : undefined}
          max={field.type === 'number' ? field.max : undefined}
        />
      )}
      {field.hint && <span className="field-hint">{field.hint}</span>}
    </div>
  );
}
export function DynamicForm({
  fields,
  initial = {},
  submitLabel = 'Save changes',
  onSubmit,
  onCancel,
}: {
  fields: Field[];
  initial?: RecordData;
  submitLabel?: string;
  onSubmit: (data: RecordData) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<RecordData>(() => {
    const managers =
      Array.isArray(initial.reportingManagerIds) && initial.reportingManagerIds.length
        ? initial.reportingManagerIds
        : initial.reportingManagerId
          ? [initial.reportingManagerId]
          : [];
    return {
      ...initialValues(fields, initial),
      _reportingManagerLabels: Object.fromEntries(
        managers
          .map((id, index) => {
            const name = Array.isArray(initial.reportingManagerNames)
              ? initial.reportingManagerNames[index]
              : initial.reportingManagerName;
            const code = Array.isArray(initial.reportingManagerCodes)
              ? initial.reportingManagerCodes[index]
              : initial.reportingManagerCode;
            return [
              String(id),
              name ? `${String(name)}${code ? ` (${String(code)})` : ''}` : undefined,
            ];
          })
          .filter((entry) => entry[1]),
      ),
    };
  });
  const [selectedRole, setSelectedRole] = useState<RecordData>();
  const effectiveFields = employeeFormFields(fields, values, selectedRole);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSubmit(buildPayload(effectiveFields, values));
    } catch (err) {
      setError(err instanceof z.ZodError ? err.issues[0].message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)}>
      <fieldset disabled={busy} className="form-grid">
        {effectiveFields.map((field) => (
          <FormField
            key={field.name}
            field={field}
            value={values[field.name]}
            values={values}
            disabled={busy}
            onChange={(value, record) => {
              if (field.name === 'roleId') setSelectedRole(record);
              setValues((previous) => {
                const next = { ...previous, [field.name]: value };
                const clearChildren = (parent: string) => {
                  effectiveFields
                    .filter((child) => child.parent === parent)
                    .forEach((child) => {
                      next[child.name] = child.type === 'multi-lookup' ? [] : '';
                      clearChildren(child.name);
                    });
                };
                clearChildren(field.name);
                return next;
              });
            }}
          />
        ))}
      </fieldset>
      {error && (
        <p className="inline-error form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button className="button" disabled={busy}>
          {busy ? 'Saving' : submitLabel}
        </button>
      </div>
    </form>
  );
}
