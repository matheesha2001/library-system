import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Login from './Login';

const { mockLogin } = vi.hoisted(() => ({ mockLogin: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ login: mockLogin }) }));

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { baseURL: 'http://localhost:5000/api' },
  },
}));

import api from '../api/client';

function renderLogin(route = '/login') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<div>Member Dashboard</div>} />
        <Route path="/admin/dashboard" element={<div>Panel Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Login', () => {
  it('logs a member in and navigates to the member dashboard', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce({
      data: { token: 'tok123', user: { id: 'u1', name: 'Jane', role: 'member' } },
    });

    renderLogin();
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText('Member Dashboard')).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'jane@example.com', password: 'password123' });
    expect(mockLogin).toHaveBeenCalledWith({ id: 'u1', name: 'Jane', role: 'member' }, 'tok123');
  });

  it('logs a staff member in and navigates to the panel dashboard', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce({
      data: { token: 'tok456', user: { id: 'u2', name: 'Sam', role: 'staff' } },
    });

    renderLogin();
    await user.type(screen.getByLabelText(/email address/i), 'sam@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText('Panel Dashboard')).toBeInTheDocument());
  });

  it('shows the server error message on invalid credentials and does not navigate', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce({ response: { data: { message: 'Invalid email or password' } } });

    renderLogin();
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows a blocked-account message from the server', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce({
      response: { data: { message: 'This account has been blocked. Please contact library staff.' } },
    });

    renderLogin();
    await user.type(screen.getByLabelText(/email address/i), 'blocked@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/account has been blocked/i)).toBeInTheDocument();
  });

  it('maps a ?error= query param to its message on load, without needing to submit', () => {
    renderLogin('/login?error=session_expired');
    expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  });

  it('toggles the password field visibility', async () => {
    const user = userEvent.setup();
    renderLogin();
    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'visibility' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
