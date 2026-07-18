import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationRooms } from '../src/sockets/index.js';

test('admin notification socket routing preserves audience isolation and HQ monitoring', () => {
  assert.deepEqual(new Set(notificationRooms({ recipientType: 'HQ', hubId: 'HUB_001', channels: ['IN_APP'] })), new Set(['hq']));
  assert.deepEqual(new Set(notificationRooms({ recipientType: 'HUB', hubId: 'HUB_001', channels: ['IN_APP'] })), new Set(['hq', 'hub:HUB_001']));
  assert.deepEqual(new Set(notificationRooms({ recipientType: 'USER', recipientId: '507f1f77bcf86cd799439011', hubId: 'HUB_001', channels: ['IN_APP'] })), new Set(['hq', 'user:507f1f77bcf86cd799439011']));
  assert.deepEqual(new Set(notificationRooms({ recipientType: 'DRIVER', hubId: 'HUB_001', channels: ['IN_APP'] })), new Set(['hq', 'role:DRIVER']));
  assert.deepEqual(new Set(notificationRooms({ recipientType: 'DRIVER', hubId: 'HUB_001', channels: ['SMS'] })), new Set(['hq']));
});
