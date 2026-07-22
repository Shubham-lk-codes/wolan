export const STATUS_FILTERS = Object.freeze([
  ['ALL', 'All drivers'],
  ['AVAILABLE', 'Available'],
  ['ON_DELIVERY', 'On delivery'],
  ['BREAK', 'Break'],
  ['OFFLINE', 'Offline'],
  ['DELAYED', 'Delayed'],
]);

export const statusLabel = (value) => String(value || 'UNKNOWN')
  .toLowerCase()
  .split('_')
  .map((word) => word ? word[0].toUpperCase() + word.slice(1) : '')
  .join(' ');

export const idOf = (value) => String(value?._id ?? value?.id ?? value ?? '');

export function eventLocation(payload) {
  const point = payload?.location;
  if (point?.coordinates?.length === 2) {
    return {
      lng: Number(point.coordinates[0]),
      lat: Number(point.coordinates[1]),
      recordedAt: payload.recordedAt ?? new Date().toISOString(),
      speed: Number.isFinite(payload.speed) ? payload.speed : null,
      heading: Number.isFinite(payload.heading) ? payload.heading : null,
      accuracy: Number.isFinite(payload.accuracy) ? payload.accuracy : null,
      battery: Number.isFinite(payload.battery) ? payload.battery : null,
    };
  }
  if (Number.isFinite(point?.lat) && Number.isFinite(point?.lng)) return { ...point, recordedAt: payload.recordedAt ?? new Date().toISOString() };
  return null;
}

export function distanceMetres(left, right) {
  if (!left || !right) return null;
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(right.lat - left.lat);
  const dLng = radians(right.lng - left.lng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(left.lat)) * Math.cos(radians(right.lat)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function withMismatch(order) {
  if (!order) return order;
  const separation = distanceMetres(order.riderLocation, order.packageLocation);
  if (separation === null) return order;
  return { ...order, separationMetres: Math.round(separation), mismatch: separation >= 500 || Boolean(order.mismatchAlert) };
}

export function formatTime(value, empty = 'Not available') {
  if (!value) return empty;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? empty : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(value) {
  if (!value) return 'No GPS fix';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1_000));
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
