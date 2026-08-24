import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, act, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/testUtils';
import MyBorrows from './MyBorrows';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: mockUseAuth }));

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    defaults: { baseURL: 'http://localhost:5000/api' },
  },
}));

vi.mock('../api/socket', () => ({
  default: { on: vi.fn(), off: vi.fn(), connect: vi.fn(), disconnect: vi.fn() },
}));

import api from '../api/client';
import socket from '../api/socket';

// Returns the callback MyBorrows registered for `event` via socket.on(...).
function getSocketHandler(event) {
  const call = socket.on.mock.calls.find(([e]) => e === event);
  return call?.[1];
}

const OTHER_USER_RECORD = {
  _id: 'rec-other',
  book: { _id: 'book2', title: 'Someone Else\'s Book' },
  member: 'other-user',
  borrowDate: '2026-01-01T00:00:00.000Z',
  dueDate: '2026-01-15T00:00:00.000Z',
  returnDate: null,
  fineAmount: 0,
  fineWaived: false,
};

const MY_RECORD = {
  _id: 'rec-mine',
  book: { _id: 'book1', title: 'My Borrowed Book' },
  member: 'user1',
  borrowDate: '2026-01-01T00:00:00.000Z',
  dueDate: '2026-01-15T00:00:00.000Z',
  returnDate: '2026-01-20T00:00:00.000Z', // returned, late
  fineAmount: 2.5,
  fineWaived: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: 'user1', name: 'Test User', role: 'member' }, logout: vi.fn() });
});

describe('MyBorrows', () => {
  it('fetches records and only shows the current user\'s own borrows', async () => {
    api.get.mockResolvedValueOnce({ data: [MY_RECORD, OTHER_USER_RECORD] });

    renderWithProviders(<MyBorrows />);

    expect(await screen.findByText('My Borrowed Book')).toBeInTheDocument();
    expect(screen.queryByText('Someone Else\'s Book')).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/borrow');
  });

  it('updates the displayed record when a borrowUpdated event fires for it (e.g. staff waives the fine)', async () => {
    api.get.mockResolvedValueOnce({ data: [MY_RECORD] });
    renderWithProviders(<MyBorrows />);

    await screen.findByText('My Borrowed Book');
    expect(screen.getByText('$2.50')).toBeInTheDocument();

    const handleBorrowUpdated = getSocketHandler('borrowUpdated');
    expect(handleBorrowUpdated).toBeInstanceOf(Function);

    act(() => {
      handleBorrowUpdated({ ...MY_RECORD, fineWaived: true });
    });

    expect(await screen.findByText('Waived')).toBeInTheDocument();
    expect(screen.queryByText('$2.50')).not.toBeInTheDocument();
    // Only re-rendered in place - fetchRecords() was not called again.
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('ignores a borrowUpdated event for a record that is not currently displayed', async () => {
    api.get.mockResolvedValueOnce({ data: [MY_RECORD] });
    renderWithProviders(<MyBorrows />);
    await screen.findByText('My Borrowed Book');

    act(() => {
      getSocketHandler('borrowUpdated')({ _id: 'some-unrelated-record', fineWaived: true });
    });

    // Nothing changes - update was a no-op map over an id that isn't there.
    await waitFor(() => expect(screen.getByText('My Borrowed Book')).toBeInTheDocument());
    expect(screen.queryByText('Waived')).not.toBeInTheDocument();
  });

  it('removes the record when a borrowDeleted event fires for it', async () => {
    api.get.mockResolvedValueOnce({ data: [MY_RECORD] });
    renderWithProviders(<MyBorrows />);
    await screen.findByText('My Borrowed Book');

    act(() => {
      getSocketHandler('borrowDeleted')({ id: 'rec-mine' });
    });

    await waitFor(() => expect(screen.queryByText('My Borrowed Book')).not.toBeInTheDocument());
    expect(screen.getByText('No borrow records yet.')).toBeInTheDocument();
  });

  it('unregisters the socket listeners on unmount', async () => {
    api.get.mockResolvedValueOnce({ data: [] });
    const { unmount } = renderWithProviders(<MyBorrows />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    unmount();
    expect(socket.off).toHaveBeenCalledWith('borrowUpdated');
    expect(socket.off).toHaveBeenCalledWith('borrowDeleted');
  });
});
