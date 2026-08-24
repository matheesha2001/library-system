import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminOnlyRoute from './AdminOnlyRoute';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: mockUseAuth }));

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/admin/categories']}>
      <Routes>
        <Route
          path="/admin/categories"
          element={
            <AdminOnlyRoute>
              <div>Admin-Only Content</div>
            </AdminOnlyRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/dashboard" element={<div>Member Dashboard</div>} />
        <Route path="/admin/dashboard" element={<div>Panel Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminOnlyRoute', () => {
  it('redirects to /login when there is no logged-in user', () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderGuarded();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects a member to /dashboard - no panel access at all', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', role: 'member' } });
    renderGuarded();
    expect(screen.getByText('Member Dashboard')).toBeInTheDocument();
  });

  it('redirects staff to /admin/dashboard - has panel access, but not this admin-only page', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u2', role: 'staff' } });
    renderGuarded();
    expect(screen.getByText('Panel Dashboard')).toBeInTheDocument();
  });

  it('renders the page for admin', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u3', role: 'admin' } });
    renderGuarded();
    expect(screen.getByText('Admin-Only Content')).toBeInTheDocument();
  });
});
