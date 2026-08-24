import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Register from './Register';

vi.mock('../api/client', () => ({
  default: { post: vi.fn() },
}));

import api from '../api/client';

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function fillValidForm(user, { password = 'Password1!' } = {}) {
  await user.type(screen.getByLabelText(/full name/i), 'Jane Doe');
  await user.type(screen.getByLabelText(/university email/i), 'jane@example.com');
  await user.type(screen.getByLabelText(/^password$/i), password);
  await user.type(screen.getByLabelText(/confirm password/i), password);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Register - password strength meter', () => {
  it('rates a short, all-lowercase password as Weak', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText(/^password$/i), 'password');
    expect(screen.getByText('Weak')).toBeInTheDocument();
  });

  it('rates a long password with upper/lower/digit/symbol as Strong', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('shows no meter until the password field has content', () => {
    renderRegister();
    expect(screen.queryByText('Weak')).not.toBeInTheDocument();
    expect(screen.queryByText('Strong')).not.toBeInTheDocument();
  });
});

describe('Register - validation errors', () => {
  it('flags mismatched passwords once the confirm field is touched', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Different1!');
    await user.tab(); // blur the confirm field

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rejects submission without accepting the Terms & Conditions', async () => {
    const user = userEvent.setup();
    renderRegister();
    await fillValidForm(user);
    // Terms checkbox deliberately left unchecked
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByText('You must accept the Terms & Conditions to continue')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 8 characters on submit', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText(/full name/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/university email/i), 'jane@example.com');
    // minLength=8 on the input would normally block native submission, but
    // the component's own JS check is what actually renders this message.
    await user.type(screen.getByLabelText(/^password$/i), 'short1!');
    await user.type(screen.getByLabelText(/confirm password/i), 'short1!');
    await user.click(screen.getByLabelText(/agree to the/i));
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('Register - submission', () => {
  it('registers successfully and redirects to /login after a short delay', async () => {
    // Real timers rather than fake ones: the 900ms redirect delay in
    // Register.jsx interacts with userEvent's own internal delays and RTL's
    // findBy/waitFor polling (which also runs on timers), and mocking all
    // three together is significantly more fragile than just waiting the
    // ~900ms for real - this isn't a hot path where that cost matters.
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce({ data: { id: 'u1' } });

    renderRegister();
    await fillValidForm(user);
    await user.click(screen.getByLabelText(/agree to the/i));
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByText(/account created/i)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      name: 'Jane Doe',
      studentId: '',
      email: 'jane@example.com',
      password: 'Password1!',
    });

    expect(await screen.findByText('Login Page', {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('shows the server error message when registration fails (e.g. duplicate email)', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce({ response: { data: { message: 'Email already registered' } } });

    renderRegister();
    await fillValidForm(user);
    await user.click(screen.getByLabelText(/agree to the/i));
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });
});
