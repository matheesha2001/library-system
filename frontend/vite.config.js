import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pinned to match backend/.env's CLIENT_URL (used as the CORS origin,
  // GitHub OAuth redirect target, and password-reset link base) - Vite's
  // own default of 5173 doesn't match it, which silently breaks CORS for
  // every request once the backend restricts origins instead of allowing any.
  server: {
    port: 3000,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
})
