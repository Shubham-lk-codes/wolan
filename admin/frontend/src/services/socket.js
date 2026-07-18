import { io } from 'socket.io-client';
import { adminSocketUrl } from '../config/endpoints';
import { tokenStorage } from './tokenStorage';

let socket;
export function getSocket() {
  const token = tokenStorage.get();
  if (!token) return null;
  if (!socket) socket = io(adminSocketUrl, { auth: { token }, autoConnect: false, transports: ['polling', 'websocket'] });
  socket.auth = { token };
  return socket;
}
export function disconnectSocket() { socket?.disconnect(); socket = undefined; }
