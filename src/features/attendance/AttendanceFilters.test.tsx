import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceFilters } from './AttendanceFilters';

vi.mock('../auth/auth-context', () => ({ useAuth: () => ({ can: () => false }) }));
afterEach(cleanup);
describe('attendance filter controls', () => {
  it('applies selected statuses to the server filters and resets to today', () => {
    const onApply = vi.fn();
    render(
      <AttendanceFilters value={{ from: '2026-10-01', to: '2026-10-29' }} onApply={onApply} />,
    );
    fireEvent.change(screen.getByLabelText('Attendance status'), { target: { value: 'OPEN' } });
    fireEvent.change(screen.getByLabelText('Punctuality'), { target: { value: 'late' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(onApply).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'OPEN', lateArrival: 'true', earlyExit: '' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset to today' }));
    expect(onApply.mock.calls.at(-1)?.[0]).not.toHaveProperty('status');
  });
  it('prevents reversed ranges and hides unavailable organization lookups', () => {
    const onApply = vi.fn();
    render(
      <AttendanceFilters value={{ from: '2026-10-30', to: '2026-10-29' }} onApply={onApply} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(screen.getByRole('alert').textContent).toContain('From date');
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.queryByText('Reporting manager')).toBeNull();
  });
});
