import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiError } from '../../../services/api';
import { getSocket } from '../../../services/socket';
import { liveMapService } from '../liveMap.service';
import { distanceMetres, eventLocation, idOf, withMismatch } from '../liveMap.utils';

function mergeRiderLocation(driver, payload) {
  if (driver.id !== idOf(payload.entityId)) return driver;
  const location = eventLocation(payload);
  if (!location) return driver;
  const movedMetres = distanceMetres(driver.location, location);
  const stationarySince = movedMetres === null || movedMetres > 25 ? location.recordedAt : driver.stationarySince ?? location.recordedAt;
  const stationaryMinutes = Math.max(0, Math.floor((Date.now() - new Date(stationarySince).getTime()) / 60_000));
  const currentOrder = driver.currentOrder ? withMismatch({ ...driver.currentOrder, riderLocation: location }) : null;
  return {
    ...driver,
    location,
    lastHeartbeatAt: location.recordedAt,
    stationarySince,
    stationaryMinutes,
    idle: driver.availability !== 'OFFLINE' && stationaryMinutes >= 10,
    currentOrder,
  };
}

function mergePackageLocation(driver, payload) {
  if (!driver.currentOrder || driver.currentOrder.id !== idOf(payload.orderId)) return driver;
  const packageLocation = eventLocation(payload);
  if (!packageLocation) return driver;
  return { ...driver, currentOrder: withMismatch({ ...driver.currentOrder, packageLocation }) };
}

export function useLiveMap() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const refreshTimer = useRef(null);

  const refresh = useCallback(async (signal) => {
    try {
      const result = await liveMapService.snapshot(signal);
      setSnapshot(result);
      setError('');
      return result;
    } catch (requestError) {
      if (requestError.code !== 'ERR_CANCELED') setError(getApiError(requestError));
      return null;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => refresh(), 350);
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    const timer = window.setInterval(() => refresh(), 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.clearTimeout(refreshTimer.current);
    };
  }, [refresh]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const connected = () => setRealtimeConnected(true);
    const disconnected = () => setRealtimeConnected(false);
    const driverLocation = (payload) => setSnapshot((current) => current ? { ...current, generatedAt: new Date().toISOString(), drivers: current.drivers.map((driver) => mergeRiderLocation(driver, payload)) } : current);
    const packageLocation = (payload) => setSnapshot((current) => current ? { ...current, generatedAt: new Date().toISOString(), drivers: current.drivers.map((driver) => mergePackageLocation(driver, payload)) } : current);
    const packageMismatch = (payload) => setSnapshot((current) => current ? {
      ...current,
      drivers: current.drivers.map((driver) => driver.currentOrder?.id === idOf(payload.orderId) ? {
        ...driver,
        currentOrder: { ...driver.currentOrder, mismatch: true, separationMetres: payload.separationMetres, mismatchAlert: { id: idOf(payload.alertId), severity: 'CRITICAL', createdAt: new Date().toISOString() } },
      } : driver),
    } : current);
    const driverOffline = (payload) => setSnapshot((current) => current ? { ...current, drivers: current.drivers.map((driver) => driver.id === idOf(payload.driverId ?? payload.entityId) ? { ...driver, availability: 'OFFLINE', displayStatus: 'OFFLINE' } : driver) } : current);

    socket.on('connect', connected);
    socket.on('disconnect', disconnected);
    socket.on('connect_error', disconnected);
    socket.on('driverLocation', driverLocation);
    socket.on('packageLocation', packageLocation);
    socket.on('packageMismatch', packageMismatch);
    socket.on('driverOffline', driverOffline);
    socket.on('orderCreated', scheduleRefresh);
    socket.on('orderAssigned', scheduleRefresh);
    socket.on('orderStatusChanged', scheduleRefresh);
    socket.on('orderDelivered', scheduleRefresh);
    setRealtimeConnected(socket.connected);
    socket.connect();
    return () => {
      socket.off('connect', connected);
      socket.off('disconnect', disconnected);
      socket.off('connect_error', disconnected);
      socket.off('driverLocation', driverLocation);
      socket.off('packageLocation', packageLocation);
      socket.off('packageMismatch', packageMismatch);
      socket.off('driverOffline', driverOffline);
      socket.off('orderCreated', scheduleRefresh);
      socket.off('orderAssigned', scheduleRefresh);
      socket.off('orderStatusChanged', scheduleRefresh);
      socket.off('orderDelivered', scheduleRefresh);
    };
  }, [scheduleRefresh]);

  return { snapshot, loading, error, realtimeConnected, refresh };
}
