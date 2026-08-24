import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminRoute from './AdminRoute';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: mockUseAuth }));

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/admin/books']}>
      <Routes>
        <Route
          path="/admin/books"
          element={
            <AdminRoute>
              <div>Admin Panel Content</div>
            </AdminRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/dashboard" element={<div>Member Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminRoute', () => {
  it('redirects to /login when there is no logged-in user', () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderGuarded();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects a member to /dashboard - no panel access', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', role: 'member' } });
    renderGuarded();
    expect(screen.getByText('Member Dashboard')).toBeInTheDocument();
  });

  it('renders the panel page for staff', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u2', role: 'staff' } });
    renderGuarded();
    expect(screen.getByText('Admin Panel Content')).toBeInTheDocument();
  });

  it('renders the panel page for admin', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u3', role: 'admin' } });
    renderGuarded();
    expect(screen.getByText('Admin Panel Content')).toBeInTheDocument();
  });
});
