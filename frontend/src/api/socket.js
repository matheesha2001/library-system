import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

// Single shared socket connection used across the app
const socket = io(SOCKET_URL, { autoConnect: true });

export default socket;
