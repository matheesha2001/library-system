import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';

// Wraps `ui` with the same MemoryRouter + ThemeProvider nesting every real
// page renders under. AuthContext is deliberately NOT included here - it's
// mocked per test file instead (via vi.mock), since different tests need
// different logged-in users/roles, which a single shared wrapper can't vary.
export function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider>{ui}</ThemeProvider>
    </MemoryRouter>
  );
}
