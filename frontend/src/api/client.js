import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_BASE_URL });

// Attach the JWT token (if present) to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 here always means protect() rejected the token (missing, invalid,
// expired, or the account no longer exists) - every other auth failure in
// this app uses a different status code (e.g. login uses 400, blocked
// accounts use 403). Clear the stale session and send the user back to sign
// in instead of leaving every page on screen quietly failing.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login?error=session_expired';
    }
    return Promise.reject(error);
  }
);

export default api;
