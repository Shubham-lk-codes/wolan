import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminPortalService } from '../services/admin.js';

test('hub creation keeps its generated operational id instead of the creator hub id', () => {
  const service = new AdminPortalService();
  const creatorContext = { actorId: '507f1f77bcf86cd799439011', hubId: 'HUB_EXISTING' };

  service.resources.hubs = {
    create(data, context) { return { data, context }; },
  };

  const result = service.createResource('hubs', {
    name: 'Pune Hub',
    location: 'Pune',
    city: 'Wardha',
  }, creatorContext);

  assert.match(result.data.hubId, /^HUB_[A-Z0-9]+$/);
  assert.equal(result.data.code, result.data.hubId);
  assert.equal(result.context.hubId, result.data.hubId);
  assert.notEqual(result.context.hubId, creatorContext.hubId);
  assert.equal(result.context.actorId, creatorContext.actorId);
});
