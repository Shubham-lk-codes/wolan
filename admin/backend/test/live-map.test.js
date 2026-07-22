import assert from 'node:assert/strict';
import test from 'node:test';
import { deliveryTiming, mismatchState, stationaryState } from '../src/modules/live-map/live-map.utils.js';

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });

test('live map marks a driver idle after ten stationary minutes', () => {
  const now = new Date('2026-07-22T12:20:00.000Z');
  const state = stationaryState([
    { location: point(32.5825, 0.3476), recordedAt: '2026-07-22T12:20:00.000Z' },
    { location: point(32.58251, 0.34761), recordedAt: '2026-07-22T12:08:00.000Z' },
  ], now);
  assert.equal(state.idle, true);
  assert.equal(state.stationaryMinutes, 12);
});

test('live map detects package and rider separation over 500 metres', () => {
  const state = mismatchState({ lng: 32.5825, lat: 0.3476 }, { lng: 32.5885, lat: 0.3476 });
  assert.equal(state.mismatch, true);
  assert.ok(state.separationMetres > 500);
});

test('live map marks an overdue out-for-delivery order as delayed and returns an ETA', () => {
  const now = new Date('2026-07-22T12:00:00.000Z');
  const order = { orderStatus: 'OUT_FOR_DELIVERY', outForDeliveryAt: '2026-07-22T10:30:00.000Z', delivery: { location: point(32.60, 0.35) } };
  const timing = deliveryTiming(order, { lng: 32.58, lat: 0.34 }, now, 8);
  assert.equal(timing.delayed, true);
  assert.ok(timing.etaMinutes > 0);
  assert.ok(timing.remainingMetres > 0);
});
