import test from 'node:test';
import assert from 'node:assert/strict';
import { SHARED_MODELS } from '../models/index.js';
import { resolveHubScope } from '../permissions/index.js';
import { createOrderSchema, paginationSchema, validate } from '../validation/index.js';
import { SOCKET_EVENTS } from '../events/index.js';

test('every shared model has mandatory tenancy and audit fields', () => {
  for (const [name, model] of Object.entries(SHARED_MODELS)) {
    for (const field of ['hubId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'deletedAt', 'status']) {
      assert.ok(model.schema.path(field), `${name} is missing ${field}`);
    }
    assert.equal(model.schema.path('hubId').options.required, true, `${name}.hubId must be required`);
    assert.equal(model.schema.path('createdBy').options.required, true, `${name}.createdBy must be required`);
    assert.equal(model.schema.path('updatedBy').options.required, true, `${name}.updatedBy must be required`);
  }
});

test('write validation rejects unknown fields', () => {
  const result = createOrderSchema.safeParse({
    merchantId: '507f1f77bcf86cd799439011', customer: { name: 'Customer', phone: '+256700000000' },
    pickup: { address: 'Kampala Central' }, delivery: { address: 'Ntinda Kampala' }, itemDescription: 'Parcel', codAmount: 10_000,
    unsafeField: true,
  });
  assert.equal(result.success, false);
});

test('query validation supports the Express 5 read-only query getter', () => {
  const request = {};
  Object.defineProperty(request, 'query', { configurable: true, get: () => ({ page: '2', limit: '10' }) });
  let validationError;
  validate(paginationSchema, 'query')(request, {}, (error) => { validationError = error; });
  assert.equal(validationError, undefined);
  assert.deepEqual(request.query, { page: 2, limit: 10, sortOrder: 'desc' });
});

test('canonical realtime event names remain stable', () => {
  assert.equal(SOCKET_EVENTS.ORDER_CREATED, 'orderCreated');
  assert.equal(SOCKET_EVENTS.DRIVER_LOCATION, 'driverLocation');
  assert.equal(SOCKET_EVENTS.OTP_VERIFIED, 'OTPVerified');
});

test('hub roles are restricted to their own hub', () => {
  assert.deepEqual(resolveHubScope({ role: 'HUB_MANAGER', hubId: 'HUB_001' }), { hubId: 'HUB_001' });
  assert.throws(() => resolveHubScope({ role: 'HUB_MANAGER', hubId: 'HUB_001' }, 'HUB_002'), /Hub access denied/);
});

test('regional managers receive only assigned hubs', () => {
  assert.deepEqual(resolveHubScope({ role: 'REGIONAL_MANAGER', assignedHubIds: ['HUB_001', 'HUB_002'] }), { hubId: { $in: ['HUB_001', 'HUB_002'] } });
  assert.throws(() => resolveHubScope({ role: 'REGIONAL_MANAGER', assignedHubIds: ['HUB_001'] }, 'HUB_003'), /Hub access denied/);
});

test('directors can access all hubs or select one hub', () => {
  assert.deepEqual(resolveHubScope({ role: 'DIRECTOR' }), {});
  assert.deepEqual(resolveHubScope({ role: 'DIRECTOR' }, 'HUB_010'), { hubId: 'HUB_010' });
});
