// Vitest doesn't expose a global `expect` (globals: true isn't set - tests
// import from 'vitest' explicitly instead), so jest-dom's matchers need its
// dedicated Vitest entry point, which extends the imported `expect` rather
// than assuming a global one.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// ThemeContext reads this on mount to pick the initial light/dark theme -
// jsdom doesn't implement matchMedia at all, so any test that renders
// something under ThemeProvider (most pages, via AppShell/AdminLayout) would
// otherwise throw.
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
