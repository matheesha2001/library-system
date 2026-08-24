import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, act, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/testUtils';
import Books from './Books';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: mockUseAuth }));

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { baseURL: 'http://localhost:5000/api' },
  },
}));

vi.mock('../api/socket', () => ({
  default: { on: vi.fn(), off: vi.fn(), connect: vi.fn(), disconnect: vi.fn() },
}));

import api from '../api/client';
import socket from '../api/socket';

function getSocketHandler(event) {
  const call = socket.on.mock.calls.find(([e]) => e === event);
  return call?.[1];
}

const FULLY_BORROWED_BOOK = {
  _id: 'book1',
  title: 'The Fully Borrowed Book',
  author: 'Some Author',
  isbn: 'ISBN-1',
  availableCopies: 0,
  totalCopies: 2,
};

const MY_PENDING_RESERVATION = {
  _id: 'res1',
  book: { _id: 'book1', title: 'The Fully Borrowed Book' },
  member: 'user1',
  status: 'pending',
};

function mockBooksAndReservations({ reservations = [] } = {}) {
  api.get.mockImplementation((url) => {
    if (url === '/books') {
      return Promise.resolve({ data: { books: [FULLY_BORROWED_BOOK], totalPages: 1 } });
    }
    if (url === '/reservations/me') {
      return Promise.resolve({ data: reservations });
    }
    return Promise.resolve({ data: {} });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: 'user1', name: 'Test User', role: 'member' }, logout: vi.fn() });
});

describe('Books - reservation flow', () => {
  it('shows "Reserved" for a book with a pending reservation', async () => {
    mockBooksAndReservations({ reservations: [MY_PENDING_RESERVATION] });
    renderWithProviders(<Books />);

    expect(await screen.findByRole('button', { name: 'Reserved' })).toBeInTheDocument();
  });

  it('flips to "Ready for pickup" when a reservationReady event fires for that reservation', async () => {
    mockBooksAndReservations({ reservations: [MY_PENDING_RESERVATION] });
    renderWithProviders(<Books />);

    await screen.findByRole('button', { name: 'Reserved' });

    const handleReady = getSocketHandler('reservationReady');
    expect(handleReady).toBeInstanceOf(Function);

    act(() => {
      handleReady({ id: 'res1', book: 'book1', member: 'user1' });
    });

    expect(await screen.findByRole('button', { name: 'Ready for pickup' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reserved' })).not.toBeInTheDocument();
  });

  it('ignores a reservationReady event for a reservation that is not this user\'s', async () => {
    mockBooksAndReservations({ reservations: [MY_PENDING_RESERVATION] });
    renderWithProviders(<Books />);
    await screen.findByRole('button', { name: 'Reserved' });

    act(() => {
      getSocketHandler('reservationReady')({ id: 'some-other-reservation', book: 'book1', member: 'someone-else' });
    });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reserved' })).toBeInTheDocument());
  });

  it('updates the available copy count live on an availabilityChanged event', async () => {
    mockBooksAndReservations({ reservations: [] });
    renderWithProviders(<Books />);

    expect(await screen.findByText('0 / 2 available')).toBeInTheDocument();

    act(() => {
      getSocketHandler('availabilityChanged')({ bookId: 'book1', availableCopies: 1 });
    });

    expect(await screen.findByText('1 / 2 available')).toBeInTheDocument();
  });

  it('only adds a reservationCreated event to the list when it belongs to the current user', async () => {
    mockBooksAndReservations({ reservations: [] });
    renderWithProviders(<Books />);
    await screen.findByText('The Fully Borrowed Book');

    // A staff member sharing the `staff` room would receive this for every
    // member's reservation, not just their own - it must not be adopted as
    // "my" reservation just because the event arrived on this socket.
    act(() => {
      getSocketHandler('reservationCreated')({
        _id: 'someone-elses-reservation',
        book: { _id: 'book1', title: 'The Fully Borrowed Book' },
        member: 'a-different-user',
        status: 'pending',
      });
    });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reserve' })).toBeInTheDocument());
  });
});
