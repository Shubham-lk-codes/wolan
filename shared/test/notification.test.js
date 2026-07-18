import assert from 'node:assert/strict';
import test from 'node:test';
import { SOCKET_EVENTS } from '../events/index.js';
import { Notification } from '../models/index.js';
import { NotificationService } from '../services/index.js';

test('in-app notifications are persisted as sent and published in realtime', async t => {
  const originalCreate = Notification.create;
  t.after(() => { Notification.create = originalCreate; });
  Notification.create = async documents => documents.map(document => ({ ...document, toJSON: () => ({ ...document, _id: '507f1f77bcf86cd799439012' }) }));
  const published = [];
  const service = new NotificationService({ eventPublisher: async (event, payload) => published.push({ event, payload }) });

  const notification = await service.create({ recipientType: 'HQ', title: 'System Alert', message: 'A live notification', channels: ['IN_APP'], priority: 'HIGH' }, { hubId: 'HUB_001', actorId: '507f1f77bcf86cd799439011' });

  assert.equal(notification.status, 'SENT');
  assert.ok(notification.sentAt instanceof Date);
  assert.equal(published.length, 1);
  assert.equal(published[0].event, SOCKET_EVENTS.NEW_NOTIFICATION);
  assert.equal(published[0].payload.title, 'System Alert');
});
