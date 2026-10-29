import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkforceOverview } from './WorkforceOverview';
import { request } from '../../shared/lib/api';

const state = vi.hoisted(() => ({ md: false, panel: false }));
vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({
    user: { canManageAttendanceSettings: state.md, employeePanel: state.panel ? {} : undefined },
    can: () => true,
  }),
}));
vi.mock('../../shared/lib/api', () => ({ request: vi.fn(), errorMessage: () => 'Request failed' }));
afterEach(() => {
  cleanup();
  state.md = false;
  state.panel = false;
});
function mount() {
  vi.mocked(request).mockResolvedValue({
    success: true,
    message: '',
    data: {
      date: '2026-10-29',
      totalEmployees: 6,
      activeEmployees: 4,
      onLeave: 1,
      inactiveEmployees: 1,
      notRequired: 0,
      present: 1,
      absent: 2,
      notDue: 1,
      nonWorkingDay: 0,
      notConfigured: 1,
    },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  render(
    <QueryClientProvider client={client}>
      <WorkforceOverview filters={{ from: '2026-09-01', branchId: 'branch', status: 'OPEN' }} />
    </QueryClientProvider>,
  );
  return client;
}
describe('workforce overview', () => {
  it('shows server employee/absence counts and excludes record status/date filters from the current workforce query', async () => {
    const client = mount();
    await waitFor(() =>
      expect(screen.getByText('Total employees').parentElement?.textContent).toContain('6'),
    );
    expect(screen.getByText('Absent / no check-in').parentElement?.textContent).toContain('2');
    expect(screen.getByRole('status').textContent).toContain('no complete working schedule');
    expect(request).toHaveBeenCalledWith(
      '/attendance/workforce?branchId=branch',
      expect.anything(),
    );
    expect(screen.queryByRole('button', { name: 'Office timings & holidays' })).toBeNull();
    client.clear();
  });
  it('shows settings only for the verified MD and hides them in employee panels', async () => {
    state.md = true;
    let client = mount();
    expect(screen.getByRole('button', { name: 'Office timings & holidays' })).toBeTruthy();
    cleanup();
    client.clear();
    state.panel = true;
    client = mount();
    await waitFor(() =>
      expect(screen.getByText('Total employees').parentElement?.textContent).toContain('6'),
    );
    expect(screen.queryByRole('button', { name: 'Office timings & holidays' })).toBeNull();
    client.clear();
  });
});
