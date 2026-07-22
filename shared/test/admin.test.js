import assert from 'node:assert/strict';
import test from 'node:test';
import { COD, Merchant, Referral, SupportTicket, User, Vehicle } from '../models/index.js';
import { AdminPortalService, reportPeriodRange } from '../services/admin.js';

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

test('merchant summary returns hub-scoped database aggregates', async t => {
  const originals = {
    merchantAggregate: Merchant.aggregate,
    codAggregate: COD.aggregate,
    referralCount: Referral.countDocuments,
    ticketAggregate: SupportTicket.aggregate,
  };
  t.after(() => {
    Merchant.aggregate = originals.merchantAggregate;
    COD.aggregate = originals.codAggregate;
    Referral.countDocuments = originals.referralCount;
    SupportTicket.aggregate = originals.ticketAggregate;
  });

  let merchantPipeline;
  let codPipeline;
  let referralFilter;
  let ticketPipeline;
  Merchant.aggregate = async pipeline => {
    merchantPipeline = pipeline;
    return [{ totalMerchants: 12, eliteTier: 2, priorityTier: 3, kycPending: 4 }];
  };
  COD.aggregate = async pipeline => {
    codPipeline = pipeline;
    return [{ total: 125_000 }];
  };
  Referral.countDocuments = async filter => {
    referralFilter = filter;
    return 5;
  };
  SupportTicket.aggregate = async pipeline => {
    ticketPipeline = pipeline;
    return [{ count: 1 }];
  };

  const service = new AdminPortalService();
  const summary = await service.merchantSummary({ hubId: 'HUB_001' });

  assert.deepEqual(summary, {
    totalMerchants: 12,
    eliteTier: 2,
    priorityTier: 3,
    eliteEscalations: 1,
    kycPending: 4,
    totalCodPending: 125_000,
    m2mReferrals: 5,
    currency: 'UGX',
  });
  assert.deepEqual(merchantPipeline[0].$match, { hubId: 'HUB_001', deletedAt: null });
  assert.deepEqual(codPipeline[0].$match, { hubId: 'HUB_001', deletedAt: null, status: { $in: ['PENDING', 'COLLECTED'] } });
  assert.deepEqual(referralFilter, { hubId: 'HUB_001', deletedAt: null });
  assert.equal(ticketPipeline[3].$match['merchant.hubId'], 'HUB_001');
});

test('report periods resolve to stable UTC database ranges', () => {
  const now = new Date('2026-07-22T10:30:00.000Z');
  assert.deepEqual(reportPeriodRange('MONTHLY', now), {
    period: 'MONTHLY',
    start: new Date('2026-07-01T00:00:00.000Z'),
    end: now,
    bucket: 'day',
    label: 'This month',
  });
  assert.deepEqual(reportPeriodRange('QUARTERLY', now), {
    period: 'QUARTERLY',
    start: new Date('2026-07-01T00:00:00.000Z'),
    end: now,
    bucket: 'day',
    label: 'This quarter',
  });
  assert.deepEqual(reportPeriodRange('YEARLY', now), {
    period: 'YEARLY',
    start: new Date('2026-01-01T00:00:00.000Z'),
    end: now,
    bucket: 'month',
    label: 'This year',
  });
  assert.equal(reportPeriodRange('ALL', now, new Date('2024-03-04T12:00:00.000Z')).start.toISOString(), '2024-03-04T12:00:00.000Z');
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
