import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

// Single shared socket connection used across the app. `auth` is a function
// (not a plain object) so socket.io-client re-reads the current token from
// localStorage on every (re)connection attempt rather than baking in
// whatever was there at module load - see connectSocket() below, which
// relies on that to pick up a fresh token after login instead of replaying
// a stale one. Doesn't auto-connect: nothing should attempt a connection
// before we actually have a token (see AuthContext.jsx, which calls
// connectSocket() both on login and on mount if a session already exists).
const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: localStorage.getItem('token') }),
});

export function connectSocket() {
  // Disconnecting first forces the `auth` function above to run again with
  // whatever token is current, rather than silently no-op'ing on a socket
  // that's already connected under a previous (or no) session.
  if (socket.connected) socket.disconnect();
  socket.connect();
}

export function disconnectSocket() {
  socket.disconnect();
}

export default socket;
