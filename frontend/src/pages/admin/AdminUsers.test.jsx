import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/testUtils';
import AdminUsers from './AdminUsers';
import socket from '../../api/socket';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: mockUseAuth }));

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { baseURL: 'http://localhost:5000/api' },
  },
}));

vi.mock('../../api/socket', () => ({
  default: { on: vi.fn(), off: vi.fn(), connect: vi.fn(), disconnect: vi.fn() },
}));

import api from '../../api/client';

const MEMBER = { _id: 'member1', name: 'Alice Member', email: 'alice@example.com', role: 'member', isBlocked: false, activeBorrowsCount: 0 };
const OTHER_STAFF = { _id: 'staff2', name: 'Bob Staff', email: 'bob@example.com', role: 'staff', isBlocked: false, activeBorrowsCount: 0 };

function renderAsRole(role) {
  mockUseAuth.mockReturnValue({
    user: { id: `${role}-self`, name: 'Current User', role },
    logout: vi.fn(),
  });
  return renderWithProviders(<AdminUsers />);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: [MEMBER, OTHER_STAFF] });
});

describe('AdminUsers - staff permissions', () => {
  it('lets staff block/unblock a member but not another staff account', async () => {
    renderAsRole('staff');
    await screen.findByText('Alice Member');

    const rows = screen.getAllByRole('row');
    const memberRow = rows.find((r) => r.textContent.includes('Alice Member'));
    const staffRow = rows.find((r) => r.textContent.includes('Bob Staff'));

    expect(within(memberRow).getByTitle('Block user')).toBeInTheDocument();
    expect(within(staffRow).queryByTitle('Block user')).not.toBeInTheDocument();
    expect(within(staffRow).queryByTitle('Unblock user')).not.toBeInTheDocument();
  });

  it('hides role-change, delete, and "Create Staff Account" from staff', async () => {
    renderAsRole('staff');
    await screen.findByText('Alice Member');

    expect(screen.queryByTitle('Change user role')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete user')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create staff account/i })).not.toBeInTheDocument();
  });

  it('blocking a user calls PUT /users/:id/block after confirming the modal', async () => {
    const user = userEvent.setup();
    api.put.mockResolvedValueOnce({ data: { id: 'member1', isBlocked: true } });
    renderAsRole('staff');
    await screen.findByText('Alice Member');

    const rows = screen.getAllByRole('row');
    const memberRow = rows.find((r) => r.textContent.includes('Alice Member'));
    await user.click(within(memberRow).getByTitle('Block user'));

    expect(await screen.findByText('Block User Account?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /confirm block/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/member1/block'));
  });
});

describe('AdminUsers - admin permissions', () => {
  it('shows role-change and delete controls, and lets admin block any non-self account', async () => {
    renderAsRole('admin');
    await screen.findByText('Alice Member');

    const rows = screen.getAllByRole('row');
    const memberRow = rows.find((r) => r.textContent.includes('Alice Member'));
    const staffRow = rows.find((r) => r.textContent.includes('Bob Staff'));

    expect(within(memberRow).getByTitle('Change user role')).toBeInTheDocument();
    expect(within(memberRow).getByTitle('Delete user')).toBeInTheDocument();
    expect(within(memberRow).getByTitle('Block user')).toBeInTheDocument();
    // Unlike staff, admin can also block other staff accounts.
    expect(within(staffRow).getByTitle('Block user')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create staff account/i })).toBeInTheDocument();
  });

  it('changing a role calls PUT /users/:id/role with the newly selected role', async () => {
    const user = userEvent.setup();
    api.put.mockResolvedValueOnce({ data: { ...MEMBER, role: 'staff' } });
    renderAsRole('admin');
    await screen.findByText('Alice Member');

    const rows = screen.getAllByRole('row');
    const memberRow = rows.find((r) => r.textContent.includes('Alice Member'));
    await user.click(within(memberRow).getByTitle('Change user role'));

    expect(await screen.findByText('Change User Role')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Staff' }));
    await user.click(screen.getByRole('button', { name: /save role/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/member1/role', { role: 'staff' }));
  });
});

describe('AdminUsers - real-time updates', () => {
  it('applies a userUpdated socket event to the matching row', async () => {
    renderAsRole('admin');
    await screen.findByText('Alice Member');
    const memberRow = screen.getAllByRole('row').find((r) => r.textContent.includes('Alice Member'));
    expect(within(memberRow).getByText('Active')).toBeInTheDocument();

    const handler = socket.on.mock.calls.find(([e]) => e === 'userUpdated')[1];
    act(() => {
      handler({ id: 'member1', isBlocked: true });
    });

    await waitFor(() => expect(within(memberRow).getByText('Blocked')).toBeInTheDocument());
  });
});
