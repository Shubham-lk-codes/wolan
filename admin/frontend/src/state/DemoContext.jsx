import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getApiError } from '../services/api';
import { authService } from '../services/auth.service';
import { orderService } from '../services/order.service';
import { hubService } from '../services/resource.service';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext';

const DemoContext = createContext(null);

const initialOrders = [];
export function DemoProvider({ children }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState(initialOrders);
  const [hubs, setHubs] = useState([]);
  const [selectedHub, setSelectedHub] = useState('ALL');
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(authService.hasSession());
  const [apiConnected, setApiConnected] = useState(false);

  const notify = useCallback((message, tone = 'success') => {
    const id = crypto.randomUUID();
    setToasts(items => [...items, { id, message, tone }]);
    window.setTimeout(() => setToasts(items => items.filter(item => item.id !== id)), 3200);
  }, []);

  const mergeOrder = useCallback(order => setOrders(items => {
    const index = items.findIndex(item => item.id === order.id);
    if (index < 0) return [order, ...items];
    const next = [...items]; next[index] = { ...items[index], ...order }; return next;
  }), []);

  useEffect(() => {
    if (!user || !authService.hasSession()) return;
    const controller = new AbortController();
    Promise.all([orderService.list({}, controller.signal), hubService.list({}, controller.signal)]).then(([orderRows, hubRows]) => { setOrders(orderRows); setHubs(hubRows); setApiConnected(true); }).catch(error => { if (error.code !== 'ERR_CANCELED') notify(getApiError(error), 'error'); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [notify, user]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket(); if (!socket) return;
    const refreshOrders = () => orderService.list({}).then(setOrders).catch(() => {});
    socket.on('orderCreated', refreshOrders); socket.on('orderStatusChanged', refreshOrders); socket.on('orderAssigned', refreshOrders);
    socket.on('driverLocation', ({ orderId, location }) => setOrders(items => items.map(order => order.id === orderId ? { ...order, riderLocation: location } : order)));
    socket.connect();
    return () => { socket.off('orderCreated', refreshOrders); socket.off('orderStatusChanged', refreshOrders); socket.off('orderAssigned', refreshOrders); socket.off('driverLocation'); socket.disconnect(); };
  }, [mergeOrder, user]);

  const mutate = useCallback(async (request, success) => { try { const order = await request(); mergeOrder(order); notify(success); return { ok: true }; } catch (error) { const message = getApiError(error); notify(message, 'error'); return { ok: false, message }; } }, [mergeOrder, notify]);
  const verifyPickup = useCallback((id, key) => mutate(() => orderService.verifyPickup(id, key), 'Pickup key verified. Package can now be scanned.'), [mutate]);
  const scanAtHub = useCallback((id, code) => mutate(() => orderService.scanAtHub(id, code.trim()), 'Hub scan confirmed. Rider assignment is unlocked.'), [mutate]);
  const assignRider = useCallback((id, rider = 'Sarah N.') => mutate(() => orderService.assignRider(id, rider), `Order assigned to ${rider}.`), [mutate]);
  const completeOrder = useCallback((id, otp) => mutate(() => orderService.complete(id, otp), 'OTP accepted. Delivery completed.'), [mutate]);
  const createOrder = useCallback(payload => mutate(() => orderService.create(payload), 'Order created successfully.'), [mutate]);
  const setOrderStatus = useCallback((id,status,note) => mutate(() => orderService.setStatus(id,status,note), `Order marked ${status}.`), [mutate]);

  const visibleOrders = useMemo(() => selectedHub === 'ALL' ? orders : orders.filter(order => order.hubId === selectedHub), [orders, selectedHub]);
  const value = useMemo(() => ({ orders, visibleOrders, hubs, selectedHub, setSelectedHub, verifyPickup, scanAtHub, assignRider, completeOrder, createOrder, setOrderStatus, notify, loading, apiConnected }), [orders, visibleOrders, selectedHub, verifyPickup, scanAtHub, assignRider, completeOrder, createOrder, setOrderStatus, notify, loading, apiConnected]);

  return <DemoContext.Provider value={value}>{children}<div className="toast-stack" aria-live="polite">{toasts.map(toast => <div className={`toast ${toast.tone}`} key={toast.id}>{toast.message}</div>)}</div></DemoContext.Provider>;
}

export function useDemo() { return useContext(DemoContext); }
