import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getApiError } from '../services/api';
import { notificationService } from '../services/notification.service';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);
const idOf = item => String(item?._id || item?.id || '');
const newestFirst = items => [...items].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const knownIds = useRef(new Set());

  const ingest = useCallback(notification => {
    const id = idOf(notification);
    if (!id) return;
    const isNew = !knownIds.current.has(id);
    knownIds.current.add(id);
    setItems(current => {
      const index = current.findIndex(item => idOf(item) === id);
      if (index < 0) return newestFirst([notification, ...current]);
      const next = [...current];
      next[index] = { ...current[index], ...notification };
      return newestFirst(next);
    });
    if (isNew && !notification.readAt) setUnreadCount(count => count + 1);
  }, []);

  const refresh = useCallback(async signal => {
    const [rows, count] = await Promise.all([notificationService.list({}, signal), notificationService.unreadCount(signal)]);
    knownIds.current = new Set(rows.map(idOf));
    setItems(newestFirst(rows));
    setUnreadCount(count);
    setError('');
  }, []);

  useEffect(() => {
    if (!user) { setItems([]); setUnreadCount(0); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    refresh(controller.signal).catch(requestError => {
      if (requestError.code !== 'ERR_CANCELED') setError(getApiError(requestError));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh, user]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;
    const connected = () => setRealtimeConnected(true);
    const disconnected = () => setRealtimeConnected(false);
    socket.on('connect', connected);
    socket.on('disconnect', disconnected);
    socket.on('connect_error', disconnected);
    socket.on('newNotification', ingest);
    setRealtimeConnected(socket.connected);
    socket.connect();
    return () => {
      socket.off('connect', connected);
      socket.off('disconnect', disconnected);
      socket.off('connect_error', disconnected);
      socket.off('newNotification', ingest);
    };
  }, [ingest, user]);

  const send = useCallback(async payload => { const item = await notificationService.send(payload); ingest(item); return item; }, [ingest]);
  const markRead = useCallback(async id => {
    const current = items.find(item => idOf(item) === String(id));
    if (!current || current.readAt) return current;
    const updated = await notificationService.markRead(id);
    ingest(updated);
    setUnreadCount(count => Math.max(0, count - 1));
    return updated;
  }, [ingest, items]);
  const markAllRead = useCallback(async () => {
    const result = await notificationService.markAllRead();
    const readAt = result.readAt || new Date().toISOString();
    setItems(current => current.map(item => item.readAt ? item : { ...item, readAt }));
    setUnreadCount(0);
    return result;
  }, []);
  const remove = useCallback(async id => {
    const current = items.find(item => idOf(item) === String(id));
    await notificationService.remove(id);
    knownIds.current.delete(String(id));
    setItems(rows => rows.filter(item => idOf(item) !== String(id)));
    if (current && !current.readAt) setUnreadCount(count => Math.max(0, count - 1));
  }, [items]);

  const value = useMemo(() => ({ items, unreadCount, loading, error, realtimeConnected, refresh, send, markRead, markAllRead, remove }), [items, unreadCount, loading, error, realtimeConnected, refresh, send, markRead, markAllRead, remove]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => useContext(NotificationContext);
