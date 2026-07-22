import { LIMITS } from '@wolan/shared/constants';

export const ACTIVE_DELIVERY_STATUSES = Object.freeze(['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'AT_HUB', 'OUT_FOR_DELIVERY']);
export const MOVEMENT_THRESHOLD_METRES = 25;
export const DEFAULT_DELIVERY_MINUTES = 45;

const pointCoordinates = (point) => point?.coordinates?.length === 2 ? point.coordinates.map(Number) : null;

export function distanceMetres(left, right) {
  const a = pointCoordinates(left);
  const b = pointCoordinates(right);
  if (!a || !b) return null;
  const radians = (degrees) => degrees * Math.PI / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function locationDto(point, recordedAt, sample = {}) {
  const coordinates = pointCoordinates(point);
  if (!coordinates) return null;
  return {
    lng: coordinates[0],
    lat: coordinates[1],
    recordedAt: recordedAt ?? null,
    speed: Number.isFinite(sample.speed) ? sample.speed : null,
    heading: Number.isFinite(sample.heading) ? sample.heading : null,
    accuracy: Number.isFinite(sample.accuracy) ? sample.accuracy : null,
    battery: Number.isFinite(sample.battery) ? sample.battery : null,
  };
}

export function stationaryState(samples, now = new Date()) {
  if (!samples?.length) return { idle: false, stationarySince: null, stationaryMinutes: 0 };
  const ordered = [...samples].sort((left, right) => new Date(right.recordedAt) - new Date(left.recordedAt));
  const latest = ordered[0];
  let stationarySince = new Date(latest.recordedAt);
  for (const sample of ordered.slice(1)) {
    const separation = distanceMetres(latest.location, sample.location);
    if (separation === null || separation > MOVEMENT_THRESHOLD_METRES) break;
    stationarySince = new Date(sample.recordedAt);
  }
  const stationaryMinutes = Math.max(0, Math.floor((new Date(now) - stationarySince) / 60_000));
  return {
    idle: ordered.length > 1 && stationaryMinutes >= LIMITS.IDLE_DRIVER_MINUTES,
    stationarySince,
    stationaryMinutes,
  };
}

export function deliveryDeadline(order) {
  const scheduledAt = order?.delivery?.scheduledAt;
  if (scheduledAt) return new Date(scheduledAt);
  const anchors = {
    OUT_FOR_DELIVERY: [order?.outForDeliveryAt, DEFAULT_DELIVERY_MINUTES],
    AT_HUB: [order?.atHubAt, 90],
    PICKED_UP: [order?.pickedUpAt, 90],
    ACCEPTED: [order?.acceptedAt, 120],
    ASSIGNED: [order?.assignedAt, 120],
  };
  const [anchor, minutes] = anchors[order?.orderStatus] ?? [];
  return anchor ? new Date(new Date(anchor).getTime() + minutes * 60_000) : null;
}

export function deliveryTiming(order, riderLocation, now = new Date(), speedMetresPerSecond) {
  if (!order) return { delayed: false, deadlineAt: null, etaAt: null, etaMinutes: null, remainingMetres: null };
  const deadlineAt = deliveryDeadline(order);
  const delayed = Boolean(deadlineAt && deadlineAt.getTime() < new Date(now).getTime());
  const remainingMetres = distanceMetres(
    riderLocation ? { coordinates: [riderLocation.lng, riderLocation.lat] } : null,
    order.delivery?.location,
  );
  const usefulSpeed = Number(speedMetresPerSecond) >= 2 ? Number(speedMetresPerSecond) : 25_000 / 3_600;
  const etaMinutes = remainingMetres === null ? null : Math.max(1, Math.ceil(remainingMetres / usefulSpeed / 60));
  const etaAt = etaMinutes === null ? deadlineAt : new Date(new Date(now).getTime() + etaMinutes * 60_000);
  return { delayed, deadlineAt, etaAt, etaMinutes, remainingMetres: remainingMetres === null ? null : Math.round(remainingMetres) };
}

export function mismatchState(riderLocation, packageLocation, threshold = LIMITS.TRACKER_MISMATCH_METRES) {
  const separationMetres = distanceMetres(
    riderLocation ? { coordinates: [riderLocation.lng, riderLocation.lat] } : null,
    packageLocation ? { coordinates: [packageLocation.lng, packageLocation.lat] } : null,
  );
  return {
    mismatch: separationMetres !== null && separationMetres >= threshold,
    separationMetres: separationMetres === null ? null : Math.round(separationMetres),
  };
}
