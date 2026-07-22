import assert from 'node:assert/strict';
import test from 'node:test';
import { User, Vehicle } from '../models/index.js';
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

test('driver onboarding identifies an email conflict before creating records', async t => {
  const originalUserFindOne = User.findOne;
  const originalVehicleFindOne = Vehicle.findOne;
  t.after(() => { User.findOne = originalUserFindOne; Vehicle.findOne = originalVehicleFindOne; });
  User.findOne = () => ({ select: () => ({ lean: async () => ({ email: 'taken@example.com', phone: '+256700000001' }) }) });
  Vehicle.findOne = () => ({ select: () => ({ lean: async () => null }) });

  const service = new AdminPortalService();
  const availability = await service.driverIdentityAvailability({ email: 'Taken@Example.com', phone: '+256700000002', plateNumber: 'UAA 001A' });
  assert.deepEqual(availability, { available: false, conflicts: [{ field: 'email', message: 'This email is already assigned to another account' }] });
  await assert.rejects(
    service.assertDriverIdentityAvailable({ email: 'Taken@Example.com', phone: '+256700000002', plateNumber: 'UAA 001A' }),
    error => error.statusCode === 409 && error.code === 'DRIVER_EMAIL_IN_USE' && error.details?.field === 'email',
  );
});
