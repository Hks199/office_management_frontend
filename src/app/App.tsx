import { Suspense, lazy } from 'react';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { AuthPage } from '../features/auth/AuthPage';
import { AppLayout } from './AppLayout';
import { resources } from '../features/resources/config';
import { EmptyState, Loading } from '../shared/components/Feedback';
const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
);
const ResourcePage = lazy(() =>
  import('../features/resources/ResourcePage').then((module) => ({ default: module.ResourcePage })),
);
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);
const ReportsPage = lazy(() =>
  import('../features/insights/ReportsPage').then((module) => ({ default: module.ReportsPage })),
);
const DailySalesReportsPage = lazy(() =>
  import('../features/reports/DailySalesReportsPage').then((module) => ({
    default: module.DailySalesReportsPage,
  })),
);
const CommercialPage = lazy(() =>
  import('../features/administration/CommercialPage').then((module) => ({
    default: module.CommercialPage,
  })),
);
const OperationsPage = lazy(() =>
  import('../features/administration/OperationsPage').then((module) => ({
    default: module.OperationsPage,
  })),
);
function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          {['login', 'forgot-password', 'reset-password', 'accept-invitation'].map((path) => (
            <Route key={path} path={`/${path}`} element={<AuthPage />} />
          ))}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              {resources.map((config) => (
                <Route
                  key={config.slug}
                  path={config.slug}
                  element={<ResourcePage key={config.slug} config={config} />}
                />
              ))}
              <Route path="settings" element={<SettingsPage />} />
              <Route path="insights" element={<ReportsPage />} />
              <Route path="daily-reports" element={<DailySalesReportsPage />} />
              <Route path="commercial" element={<CommercialPage />} />
              <Route path="operations" element={<OperationsPage />} />
              <Route
                path="*"
                element={
                  <>
                    <EmptyState
                      title="Page not found"
                      description="This workspace page does not exist."
                    />
                    <Link className="button" to="/">
                      Back to overview
                    </Link>
                  </>
                }
              />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
