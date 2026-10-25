import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  CalendarCheck2,
  CircleHelp,
  FileInput,
  FileText,
  Flag,
  GitBranch,
  Globe2,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Phone,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Target,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { errorMessage } from '../shared/lib/api';
import { resources } from '../features/resources/config';
import { Modal } from '../shared/components/Modal';
import { BrandLogo } from '../shared/components/BrandLogo';
import { workspacePages } from './workspace-pages';

const icons: Record<string, LucideIcon> = {
  employees: Users,
  branches: Building2,
  contacts: UsersRound,
  customers: UsersRound,
  leads: GitBranch,
  attendance: CalendarCheck2,
  calls: Phone,
  visits: MapPin,
  'daily-reports': FileText,
  targets: Target,
  evidence: Flag,
  roles: Shield,
  policies: FileText,
  states: Globe2,
  districts: Globe2,
  blocks: Globe2,
  imports: FileInput,
  hierarchy: GitBranch,
  references: Settings2,
};
const groups = [
  { label: 'WORKSPACE', slugs: ['employees', 'branches', 'attendance', 'hierarchy'] },
  { label: 'SALES PIPELINE', slugs: ['contacts', 'leads', 'customers', 'imports'] },
  {
    label: 'ACTIVITY & PERFORMANCE',
    slugs: ['daily-reports', 'calls', 'visits', 'targets', 'evidence', 'insights'],
  },
  {
    label: 'ADMINISTRATION',
    slugs: [
      'roles',
      'policies',
      'states',
      'districts',
      'blocks',
      'references',
      'commercial',
      'operations',
    ],
  },
];
export function AppLayout() {
  const { user, can, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [searching, setSearching] = useState(false);
  const [term, setTerm] = useState('');
  const menuRef = useRef<HTMLElement>(null);
  const title =
    location.pathname === '/'
      ? 'Overview'
      : location.pathname === '/settings'
        ? 'Profile & security'
        : ([...resources, ...workspacePages].find(
            (resource) => `/${resource.slug}` === location.pathname,
          )?.title ?? 'Workspace');
  const available = [...resources, ...workspacePages].filter((resource) =>
    resource.slug === 'insights'
      ? ['reports:read', 'attendance:read', 'targets:read', 'dashboard:read'].some((permission) =>
          can(permission),
        )
      : can(resource.permission, ...(resource.needs ?? [])),
  );
  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', close);
    menuRef.current?.focus();
    return () => document.removeEventListener('keydown', close);
  }, [mobileOpen]);
  useEffect(() => {
    document.title = `${title} · Sunvika`;
  }, [title]);
  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await logout();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobileOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`} ref={menuRef} tabIndex={-1}>
        <div className="sidebar-brand">
          <Link className="brand" to="/" onClick={() => setMobileOpen(false)}>
            <BrandLogo />
          </Link>
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-avatar" aria-hidden="true">
            <Building2 size={18} />
          </span>
          <div>
            <strong>Sunvika workspace</strong>
            <span>Office management</span>
          </div>
        </div>
        <nav aria-label="Main navigation">
          <NavLink
            className={({ isActive }) => `nav-item overview-nav ${isActive ? 'active' : ''}`}
            to="/"
            end
            onClick={() => setMobileOpen(false)}
          >
            <LayoutDashboard size={18} />
            Overview
          </NavLink>
          {groups.map((group) => {
            const items = group.slugs
              .map((slug) => available.find((resource) => resource.slug === slug))
              .filter((item) => item !== undefined);
            return (
              items.length > 0 && (
                <div className="nav-group" key={group.label}>
                  <span className="nav-group-label">{group.label}</span>
                  {items.map((resource) => {
                    const Icon = icons[resource.slug] ?? BarChart3;
                    return (
                      <NavLink
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        key={resource.slug}
                        to={`/${resource.slug}`}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Icon size={17} />
                        {resource.title}
                      </NavLink>
                    );
                  })}
                </div>
              )
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            Workspace guide
          </button>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <Settings2 size={17} />
            Profile & security
          </NavLink>
          <div className="sidebar-user">
            <span className="avatar">
              {user?.firstName[0]}
              {user?.lastName[0]}
            </span>
            <div>
              <strong>
                {user?.firstName} {user?.lastName}
              </strong>
              <small>{user?.employeeCode}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              disabled={busy}
              onClick={() => void signOut()}
            >
              <LogOut size={17} />
            </button>
          </div>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <button
              aria-label="Find a module"
              className="header-search"
              onClick={() => setSearching(true)}
            >
              <Search size={17} />
              <span>Find a module</span>
            </button>
            <span className="topbar-separator" />
            <span className="live-dot" />
            <span className="workspace-status">Team workspace</span>
            <Link to="/settings" className="avatar small-avatar" aria-label="Your profile">
              {user?.firstName[0]}
              {user?.lastName[0]}
            </Link>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>
            <BrandLogo /> Office management
          </span>
          <span>
            <Sparkles size={13} />
            Powering tomorrow. Building today.
          </span>
        </footer>
      </div>
      {help && (
        <Modal title="A guide to your workspace" onClose={() => setHelp(false)}>
          <div className="guide-content">
            <p>
              Your navigation reflects the permissions assigned to your role. All records are scoped
              by the backend.
            </p>
            <h3>Getting started</h3>
            <p>
              Create approved locations and branches, configure roles and creation policies, then
              invite employees. Invitations and password reset links are delivered by the backend’s
              email worker.
            </p>
            <h3>Everyday work</h3>
            <p>
              Mark attendance with a fresh photo and device location. Manage contact relationships
              and lead assignments, submit activity reports, and review evidence before interpreting
              verified target progress.
            </p>
            <h3>Need access?</h3>
            <p>Ask your administrator to review your role grants and branch assignment.</p>
          </div>
        </Modal>
      )}
      {searching && (
        <Modal title="Find a module" onClose={() => setSearching(false)}>
          <input
            className="module-search"
            aria-label="Module name"
            placeholder="Search workspace modules…"
            value={term}
            autoFocus
            onChange={(event) => setTerm(event.target.value)}
          />
          <div className="module-results">
            {available
              .filter((resource) => resource.title.toLowerCase().includes(term.toLowerCase()))
              .map((resource) => (
                <Link
                  key={resource.slug}
                  to={`/${resource.slug}`}
                  onClick={() => {
                    setSearching(false);
                    setTerm('');
                  }}
                >
                  {resource.title}
                  <span>{resource.description}</span>
                </Link>
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
