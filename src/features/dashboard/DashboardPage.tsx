import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Download,
  Leaf,
  Phone,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import type { RecordData } from '../../shared/types/api';
import { businessDate, display, label } from '../../shared/lib/format';
import { request } from '../../shared/lib/api';
import { EmptyState, ErrorState, Loading } from '../../shared/components/Feedback';
import { DataView } from '../resources/ResourcePage';
import { ExportDialog } from '../exports/ExportDialog';

interface Snapshot {
  kind: string;
  timezone: string;
  asOf: string;
  data: Record<string, RecordData>;
}
export function DashboardPage() {
  const { user, can } = useAuth();
  const today = businessDate();
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const [dates, setDates] = useState({ startDate: `${today.slice(0, 7)}-01`, endDate: tomorrow });
  const [period, setPeriod] = useState(dates);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const params = new URLSearchParams(period).toString();
  const overview = useQuery({
    queryKey: ['dashboard', params],
    queryFn: ({ signal }) => request<Snapshot>(`/dashboard/overview?${params}`, { signal }),
    enabled: can('dashboard:read'),
  });
  const trends = useQuery({
    queryKey: ['trends', params],
    queryFn: ({ signal }) =>
      request<{ data: { rows: RecordData[] } }>(`/dashboard/trends?${params}`, { signal }),
    enabled: can('dashboard:read', 'reports:read'),
  });
  const [view, setView] = useState('overview');
  const additional = useQuery({
    queryKey: ['dashboard-view', view, params],
    queryFn: ({ signal }) =>
      request<{ data: RecordData }>(`/dashboard/${view}?${params}`, { signal }),
    enabled: view !== 'overview' && can('dashboard:read'),
  });
  if (!can('dashboard:read'))
    return (
      <>
        <div className="page-heading">
          <div>
            <span className="eyebrow">YOUR WORKSPACE</span>
            <h1>Welcome, {user?.firstName}.</h1>
            <p>Find the tools available to you in the navigation.</p>
          </div>
        </div>
        <QuickLinks />
        <EmptyState
          title="Your workspace is ready"
          description="Dashboard access has not been assigned to your role. Your available modules are listed in the sidebar."
        />
      </>
    );
  const data = overview.data?.data.data;
  function apply(event: FormEvent) {
    event.preventDefault();
    const days = (Date.parse(dates.endDate) - Date.parse(dates.startDate)) / 86400000;
    if (days < 1 || days > 366) {
      setError('Choose a date range between 1 and 366 days.');
      return;
    }
    setError('');
    setPeriod(dates);
  }
  const metrics = [
    {
      title: 'Active employees',
      value: data?.employees?.available ? data.employees.active : undefined,
      icon: Users,
      detail: 'People in your scope',
      link: '/employees',
    },
    {
      title: 'Open opportunities',
      value: data?.leads?.available ? data.leads.pendingLeads : undefined,
      icon: TrendingUp,
      detail: 'Current lead pipeline',
      link: '/leads',
    },
    {
      title: 'Approved calls',
      value: data?.activities?.available ? data.activities.approvedCalls : undefined,
      icon: Phone,
      detail: 'Verified in this period',
      link: '/calls',
    },
    {
      title: 'Active branches',
      value: data?.branches?.available ? data.branches.total : undefined,
      icon: Building2,
      detail: 'Connected locations',
      link: '/branches',
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE CLARITY FOR YOUR DAY</span>
          <h1>
            Your team. A bigger picture<span className="green-text">.</span>
          </h1>
          <p>Welcome back, {user?.firstName}. Here’s how things are moving.</p>
        </div>
        <div className="heading-actions">
          {can('reports:read', 'reports:create', 'leads:read', 'leads:receive_assignment') && (
            <Link className="button" to="/daily-reports">
              <CalendarDays size={16} />
              Daily sales reports
            </Link>
          )}
          {can('dashboard:export') && (
            <button className="button secondary" onClick={() => setExporting(true)}>
              <Download size={16} />
              Export overview
            </button>
          )}
        </div>
      </div>
      <div className="dashboard-control">
        <div className="tabs">
          <button
            className={view === 'overview' ? 'active' : ''}
            onClick={() => setView('overview')}
          >
            Overview
          </button>
          {can('reports:read', 'users:read') && (
            <button
              className={view === 'employee-performance' ? 'active' : ''}
              onClick={() => setView('employee-performance')}
            >
              Team performance
            </button>
          )}
          {can('reports:read', 'branches:read') && (
            <button
              className={view === 'branch-performance' ? 'active' : ''}
              onClick={() => setView('branch-performance')}
            >
              Branch performance
            </button>
          )}
        </div>
        <form className="date-filter" onSubmit={apply}>
          <CalendarDays size={16} />
          <input
            type="date"
            aria-label="Period start"
            required
            value={dates.startDate}
            onChange={(event) => setDates({ ...dates, startDate: event.target.value })}
          />
          <span>to</span>
          <input
            type="date"
            aria-label="Period end (exclusive)"
            title="Exclusive end date"
            required
            value={dates.endDate}
            onChange={(event) => setDates({ ...dates, endDate: event.target.value })}
          />
          <button className="text-button" type="submit">
            Apply
          </button>
        </form>
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {view !== 'overview' ? (
        <section className="panel performance-panel">
          <h2>{label(view)}</h2>
          {additional.isPending ? (
            <Loading />
          ) : additional.isError ? (
            <ErrorState error={additional.error} retry={() => void additional.refetch()} />
          ) : (
            <DataView data={additional.data?.data.data} />
          )}
        </section>
      ) : overview.isPending ? (
        <Loading />
      ) : overview.isError ? (
        <ErrorState error={overview.error} retry={() => void overview.refetch()} />
      ) : (
        <>
          <div className="metrics-grid">
            {metrics.map(({ title, value, icon: Icon, detail, link }) => (
              <section className="metric-card" key={title}>
                <div className="metric-heading">
                  <span>{title}</span>
                  <Icon size={18} />
                </div>
                <strong>{value === undefined ? '—' : display(value)}</strong>
                <div className="metric-footer">
                  <span>{value === undefined ? 'Not available in your scope' : detail}</span>
                  {value !== undefined && (
                    <Link to={link} aria-label={`View ${title.toLowerCase()}`}>
                      <ArrowUpRight size={18} />
                    </Link>
                  )}
                </div>
              </section>
            ))}
          </div>
          <div className="dashboard-main-grid">
            <section className="panel activity-panel">
              <div className="panel-heading">
                <div>
                  <h2>Activity, with impact</h2>
                  <span className="muted">Approved calls and site visits by month</span>
                </div>
                <span className="badge green">Verified only</span>
              </div>
              {!can('reports:read') ? (
                <EmptyState
                  title="Activity is unavailable"
                  description="Your role needs report-read access to view activity."
                />
              ) : trends.isPending ? (
                <Loading />
              ) : trends.isError ? (
                <ErrorState error={trends.error} retry={() => void trends.refetch()} />
              ) : (
                <ActivityChart rows={trends.data?.data.data.rows ?? []} />
              )}
            </section>
            <section className="focus-card">
              <div className="focus-icon">
                <Leaf size={24} />
              </div>
              <span className="eyebrow">ROOM TO GROW</span>
              <h2>
                Small steps.
                <br /> Shared progress.
              </h2>
              <p>Keep the team focused on the milestones that matter.</p>
              {can('targets:read') && (
                <Link className="button lime" to="/targets">
                  Explore team targets
                  <ArrowRight size={16} />
                </Link>
              )}
              <div className="focus-lines" aria-hidden="true" />
            </section>
          </div>
          <div className="dashboard-bottom-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Opportunity pipeline</h2>
                  <span className="muted">Current status of visible leads</span>
                </div>
                {can('leads:read') && (
                  <Link className="text-button" to="/leads">
                    View leads
                    <ArrowRight size={15} />
                  </Link>
                )}
              </div>
              {data?.leads?.available ? (
                <Funnel rows={(data.leads.currentStatusFunnel as RecordData[]) ?? []} />
              ) : (
                <EmptyState
                  title="Pipeline unavailable"
                  description="Lead-read access is required."
                />
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Make your next move</h2>
                  <span className="muted">A few useful places to start</span>
                </div>
              </div>
              <QuickLinks />
            </section>
          </div>
          <p className="dashboard-footnote">
            Updated {display(overview.data?.data.asOf)} · Asia/Kolkata · Metrics reflect your
            permitted scope. Date ranges use an exclusive end date.
          </p>
        </>
      )}
      {exporting && (
        <ExportDialog
          kind="dashboard"
          dashboardKind={view}
          query={period}
          onClose={() => setExporting(false)}
        />
      )}
    </>
  );
}
function ActivityChart({ rows }: { rows: RecordData[] }) {
  const months = [
    ...new Set(
      rows
        .filter((row) => ['approvedCalls', 'approvedVisits'].includes(String(row.metric)))
        .map((row) => String(row.month)),
    ),
  ].sort();
  if (!months.length)
    return (
      <EmptyState
        title="A fresh start for this period"
        description="Approved activity will appear here when reports are reviewed."
      />
    );
  const values = months.map((month) => ({
    month,
    calls: Number(
      rows.find((row) => row.month === month && row.metric === 'approvedCalls')?.value ?? 0,
    ),
    visits: Number(
      rows.find((row) => row.month === month && row.metric === 'approvedVisits')?.value ?? 0,
    ),
  }));
  const max =
    Math.ceil(Math.max(1, ...values.flatMap((value) => [value.calls, value.visits])) / 4) * 4;
  const step = 620 / months.length;
  return (
    <div className="chart">
      <div className="chart-legend">
        <span>
          <i className="calls-dot" />
          Calls
        </span>
        <span>
          <i className="visits-dot" />
          Site visits
        </span>
      </div>
      <svg viewBox="0 0 700 260" role="img" aria-label="Approved call and visit totals per month">
        {[0, 1, 2, 3, 4].map((tick) => (
          <g key={tick}>
            <line x1="48" x2="680" y1={210 - tick * 45} y2={210 - tick * 45} stroke="#e9edf6" />
            <text x="38" y={214 - tick * 45} textAnchor="end" className="chart-label">
              {Math.round((max * tick) / 4)}
            </text>
          </g>
        ))}
        {values.map((value, index) => (
          <g key={value.month}>
            <rect
              x={58 + step * index}
              y={210 - (180 * value.calls) / max}
              width={Math.min(28, step / 3)}
              height={(180 * value.calls) / max}
              rx="4"
              fill="#3532a0"
            >
              <title>
                {value.month}: {value.calls} approved calls
              </title>
            </rect>
            <rect
              x={62 + step * index + Math.min(28, step / 3)}
              y={210 - (180 * value.visits) / max}
              width={Math.min(28, step / 3)}
              height={(180 * value.visits) / max}
              rx="4"
              fill="#f49a4d"
            >
              <title>
                {value.month}: {value.visits} approved visits
              </title>
            </rect>
            <text
              x={58 + step * index + Math.min(28, step / 3)}
              y="239"
              textAnchor="middle"
              className="chart-label"
            >
              {value.month}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
function Funnel({ rows }: { rows: RecordData[] }) {
  if (!rows.length) return <EmptyState title="No leads in this scope" />;
  const total = rows.reduce((sum, row) => sum + Number(row.count), 0);
  return (
    <div className="funnel">
      {rows.map((row) => (
        <div className="funnel-row" key={String(row._id)}>
          <div>
            <span>{label(display(row._id))}</span>
            <strong>{display(row.count)}</strong>
          </div>
          <svg viewBox="0 0 400 6" preserveAspectRatio="none" aria-hidden="true">
            <rect width="400" height="6" rx="3" fill="#edeefa" />
            <rect
              width={(400 * Number(row.count)) / Math.max(1, total)}
              height="6"
              rx="3"
              fill="#6560c8"
            />
          </svg>
        </div>
      ))}
    </div>
  );
}
function QuickLinks() {
  const { can } = useAuth();
  return (
    <div className="quick-links">
      {[
        {
          title: 'Your people',
          text: 'Manage employees and invitations',
          to: '/employees',
          permission: 'users:read',
          icon: Users,
        },
        {
          title: 'Daily attendance',
          text: 'Review the team’s working day',
          to: '/attendance',
          permission: 'attendance:read',
          icon: CalendarDays,
        },
        {
          title: 'Team targets',
          text: 'Follow verified milestones',
          to: '/targets',
          permission: 'targets:read',
          icon: Target,
        },
      ]
        .filter((item) => can(item.permission))
        .map(({ title, text, to, icon: Icon }) => (
          <Link key={to} to={to}>
            <span className="quick-icon">
              <Icon size={19} />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{text}</small>
            </span>
            <ArrowUpRight size={17} />
          </Link>
        ))}
    </div>
  );
}
