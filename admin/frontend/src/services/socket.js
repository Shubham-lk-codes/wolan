import { io } from 'socket.io-client';
import { tokenStorage } from './tokenStorage';

let socket;
export function getSocket() {
  const token = tokenStorage.get();
  if (!token) return null;
  const socketUrl = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin);
  if (!socket) socket = io(socketUrl, { auth: { token }, autoConnect: false, transports: ['polling', 'websocket'] });
  socket.auth = { token };
  return socket;
}
export function disconnectSocket() { socket?.disconnect(); socket = undefined; }
