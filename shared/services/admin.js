import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import {
  AuditLog, COD, Customer, Driver, DriverEarning, FinePenalty, GPSDevice, Hub, Incident, KYCDocument, Merchant, Notification, Order, Package, Payment, Rating, Referral, Report, SecurityAlert, Setting, SupportTicket, Tracking, User, Vehicle, Zone,
} from '../models/index.js';
import { ROLES, SYSTEM_ACTOR_ID } from '../constants/index.js';
import { withTransaction } from '../repositories/index.js';
import { AppError } from '../utils/index.js';
import { AuthService, CODService, CrudService } from './index.js';

const generatedCode = (prefix) => `${prefix}_${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`;

const resourceDefinitions = Object.freeze({
  hubs: [Hub, { searchFields: ['code', 'name', 'city', 'region'], filterFields: ['status', 'region'] }],
  merchants: [Merchant, { searchFields: ['merchantCode', 'businessName', 'shopName', 'phone'], filterFields: ['status', 'tier', 'kycStatus'] }],
  drivers: [Driver, { searchFields: ['driverCode', 'name', 'phone', 'plateNumber'], filterFields: ['status', 'availability'] }],
  packages: [Package, { searchFields: ['packageTrackingId', 'description', 'sealNumber'], filterFields: ['status', 'custodyStatus'] }],
  trackers: [GPSDevice, { searchFields: ['serialNumber', 'imei', 'provider'], filterFields: ['status', 'deviceType'] }],
  payments: [Payment, { searchFields: ['paymentNumber', 'providerReference'], filterFields: ['status', 'type', 'merchantId', 'driverId'] }],
  incidents: [Incident, { searchFields: ['incidentNumber', 'description'], filterFields: ['status', 'type', 'driverId'] }],
  notifications: [Notification, { searchFields: ['title', 'message'], filterFields: ['status', 'recipientType', 'recipientId'] }],
  settings: [Setting, { searchFields: ['key', 'description'], filterFields: ['status'] }],
  zones: [Zone, { searchFields: ['code', 'name'], filterFields: ['status'] }],
  reports: [Report, { searchFields: ['type'], filterFields: ['status', 'format'] }],
  referrals: [Referral, { searchFields: ['referralCode'], filterFields: ['status', 'referrerMerchantId'] }],
  customers: [Customer, { searchFields: ['name', 'phone', 'email'], filterFields: ['status'] }],
  alerts: [SecurityAlert, { searchFields: ['type'], filterFields: ['status', 'type', 'severity'] }],
  audit: [AuditLog, { searchFields: ['action', 'resourceType', 'requestId'], filterFields: ['status', 'actorId', 'resourceType'] }],
  tickets: [SupportTicket, { searchFields: ['subject', 'message'], filterFields: ['status', 'priority', 'assignedTo'] }],
});

export class AdminPortalService {
  constructor() {
    this.cod = new CODService();
    this.users = new CrudService(User, { searchFields: ['name', 'email', 'phone'], filterFields: ['status', 'role'] });
    this.resources = Object.fromEntries(Object.entries(resourceDefinitions).map(([name, [model, options]]) => [name, new CrudService(model, options)]));
  }

  resource(name) {
    const service = this.resources[name];
    if (!service) throw new AppError('Unsupported admin resource', 404, 'RESOURCE_NOT_FOUND');
    return service;
  }

  async dashboard(scope) {
    const filter = { ...scope, deletedAt: null };
    const [orderGroups, onlineDrivers, merchants, activeAlerts, codExposure, recentOrders, liveRiders] = await Promise.all([
      Order.aggregate([{ $match: filter }, { $group: { _id: '$orderStatus', count: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } }]),
      Driver.countDocuments({ ...filter, availability: { $ne: 'OFFLINE' } }),
      Merchant.countDocuments(filter),
      SecurityAlert.countDocuments({ ...filter, status: 'OPEN' }),
      this.cod.exposure(scope),
      Order.find(filter).select('orderNumber merchantId driverId customer delivery orderStatus pricing paymentMethod codAmount createdAt').populate('merchantId', 'businessName shopName').populate('driverId', 'name').sort({ createdAt: -1 }).limit(10).lean(),
      Driver.find({ ...filter, availability: { $ne: 'OFFLINE' } }).select('name availability completedDeliveries currentLocation vehicleId').sort({ lastHeartbeatAt: -1 }).limit(20).lean(),
    ]);
    return {
      orderStats: Object.fromEntries(orderGroups.map((item) => [item._id, { count: item.count, revenue: item.revenue }])),
      onlineDrivers, merchants, activeAlerts, codExposure, recentOrders, liveRiders,
    };
  }

  async driverWorkspace(id, scope) {
    const driver = await Driver.findOne({ _id: id, ...scope, deletedAt: null }).lean();
    if (!driver) throw new AppError('Driver not found', 404, 'DRIVER_NOT_FOUND');

    const related = { hubId: driver.hubId, deletedAt: null };
    const [user, vehicle, gpsDevice, kycDocuments, orders, alerts, fines, earnings, payments, incidents, tickets, latestTracking] = await Promise.all([
      User.findOne({ _id: driver.userId, ...related }).select('name email phone role status lastLoginAt').lean(),
      driver.vehicleId ? Vehicle.findOne({ _id: driver.vehicleId, ...related }).lean() : null,
      driver.gpsDeviceId ? GPSDevice.findOne({ _id: driver.gpsDeviceId, ...related }).lean() : null,
      KYCDocument.find({ ...related, ownerType: 'DRIVER', ownerId: driver._id }).sort({ createdAt: -1 }).lean(),
      Order.find({ ...related, driverId: driver._id }).select('orderNumber customer pickup delivery orderStatus paymentMethod paymentStatus codAmount pricing createdAt assignedAt deliveredAt failedAt').sort({ createdAt: -1 }).limit(50).lean(),
      SecurityAlert.find({ ...related, driverId: driver._id }).sort({ createdAt: -1 }).limit(50).lean(),
      FinePenalty.find({ ...related, driverId: driver._id }).sort({ createdAt: -1 }).limit(50).lean(),
      DriverEarning.find({ ...related, driverId: driver._id }).sort({ createdAt: -1 }).limit(100).lean(),
      Payment.find({ ...related, driverId: driver._id }).select('paymentNumber type amount currency provider providerReference status paidAt failedAt createdAt').sort({ createdAt: -1 }).limit(100).lean(),
      Incident.find({ ...related, driverId: driver._id }).sort({ createdAt: -1 }).limit(50).lean(),
      driver.userId ? SupportTicket.find({ ...related, assignedTo: driver.userId }).sort({ createdAt: -1 }).limit(50).lean() : [],
      Tracking.findOne({ ...related, entityType: 'DRIVER', entityId: driver._id }).sort({ recordedAt: -1 }).lean(),
    ]);

    const attempts = Number(driver.completedDeliveries || 0) + Number(driver.failedDeliveries || 0);
    const totalEarnings = earnings.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalFines = fines.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
      driver: { ...driver, acceptanceRate: attempts ? Number((Number(driver.completedDeliveries || 0) / attempts * 100).toFixed(1)) : 0 },
      user, vehicle, gpsDevice, kycDocuments, orders, alerts, fines, earnings, payments, incidents, tickets, latestTracking,
      metrics: {
        acceptanceRate: attempts ? Number((Number(driver.completedDeliveries || 0) / attempts * 100).toFixed(1)) : 0,
        totalEarnings,
        totalFines,
        openAlerts: alerts.filter((item) => item.status === 'OPEN').length,
        openIncidents: incidents.filter((item) => !item.resolvedAt && item.status !== 'RESOLVED').length,
      },
    };
  }

  async reportOverview(scope) {
    const filter = { ...scope, deletedAt: null };
    const [statusRows, daily, drivers, hubs, zones, codRows, customers] = await Promise.all([
      Order.aggregate([{ $match: filter }, { $group: { _id: '$orderStatus', orders: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'DELIVERED'] }, '$pricing.total', 0] } }, deliveryMinutes: { $avg: { $cond: [{ $and: ['$deliveredAt', '$createdAt'] }, { $divide: [{ $subtract: ['$deliveredAt', '$createdAt'] }, 60_000] }, null] } } } }]),
      Order.aggregate([{ $match: filter }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, orders: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'DELIVERED'] }, '$pricing.total', 0] } } } }, { $sort: { _id: 1 } }, { $limit: 90 }]),
      Driver.find(filter).select('name driverCode availability completedDeliveries rating codHeld vehicleId status').sort({ completedDeliveries: -1 }).limit(100).lean(),
      Hub.find(filter).select('hubId code name city region status dailyTarget').sort({ name: 1 }).lean(),
      Zone.find(filter).select('code name status').sort({ name: 1 }).lean(),
      COD.aggregate([{ $match: filter }, { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Customer.aggregate([{ $match: filter }, { $group: { _id: null, unique: { $sum: 1 }, repeat: { $sum: { $cond: [{ $gt: ['$orderCount', 1] }, 1, 0] } }, orders: { $sum: '$orderCount' } } }]),
    ]);
    const totalOrders = statusRows.reduce((sum, row) => sum + row.orders, 0);
    const revenue = statusRows.reduce((sum, row) => sum + row.revenue, 0);
    const failed = statusRows.find((row) => row._id === 'FAILED')?.orders ?? 0;
    const deliveryValues = statusRows.map((row) => row.deliveryMinutes).filter(Number.isFinite);
    const statusMix = Object.fromEntries(statusRows.map((row) => [row._id.toLowerCase().split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' '), row.orders]));
    const customer = customers[0] ?? { unique: 0, repeat: 0, orders: 0 };
    return {
      totalOrders, revenue, failedRate: totalOrders ? Number((failed / totalOrders * 100).toFixed(1)) : 0,
      avgDeliveryMinutes: deliveryValues.length ? Math.round(deliveryValues.reduce((sum, value) => sum + value, 0) / deliveryValues.length) : 0,
      statusMix, daily, riders: drivers, hubs, zones, cod: { total: codRows.reduce((sum, row) => sum + row.amount, 0), byStatus: codRows },
      customers: { unique: customer.unique, repeat: customer.repeat, averageOrders: customer.unique ? Number((customer.orders / customer.unique).toFixed(1)) : 0, failedOrders: failed },
    };
  }

  async exportOrdersCsv(scope) {
    const rows = await Order.find({ ...scope, deletedAt: null }).select('orderNumber hubId orderStatus merchantId driverId customer createdAt deliveredAt codAmount pricing.total').sort({ createdAt: -1 }).limit(50_000).lean();
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const header = ['orderNumber', 'hubId', 'status', 'merchantId', 'driverId', 'customer', 'customerPhone', 'codAmount', 'deliveryFee', 'createdAt', 'deliveredAt'];
    return [header.join(','), ...rows.map((row) => [row.orderNumber, row.hubId, row.orderStatus, row.merchantId, row.driverId, row.customer?.name, row.customer?.phone, row.codAmount, row.pricing?.total, row.createdAt?.toISOString(), row.deliveredAt?.toISOString()].map(escape).join(','))].join('\n');
  }

  async saveSettings(input, context) {
    const entries = Object.entries(input);
    if (!entries.length) throw new AppError('At least one setting is required', 422, 'SETTING_REQUIRED');
    await Setting.bulkWrite(entries.map(([key, value]) => ({
      updateOne: {
        filter: { hubId: context.hubId, key, deletedAt: null },
        update: { $setOnInsert: { hubId: context.hubId, key, createdBy: context.actorId }, $set: { value, status: 'ACTIVE', updatedBy: context.actorId } },
        upsert: true,
      },
    })));
    return Setting.find({ hubId: context.hubId, key: { $in: entries.map(([key]) => key) }, deletedAt: null }).lean();
  }

  listUsers(scope, query) { return this.users.list(scope, query); }
  updateUser(id, scope, input, context) {
    const allowed = Object.fromEntries(Object.entries(input).filter(([key]) => ['name', 'email', 'phone', 'role', 'permissions', 'assignedHubIds', 'status'].includes(key)));
    if (allowed.status) allowed.status = String(allowed.status).toUpperCase().replaceAll(' ', '_');
    return this.users.update(id, scope, allowed, context);
  }

  listResource(name, scope, query) { return this.resource(name).list(scope, query); }
  getResource(name, id, scope) { return this.resource(name).get(id, scope); }
  updateResource(name, id, scope, input, context) {
    const changes = name === 'hubs' ? this.prepareHubInput(input) : name === 'drivers' ? this.prepareDriverUpdate(input) : input;
    return this.resource(name).update(id, scope, changes, context);
  }
  deleteResource(name, id, scope, context) { return this.resource(name).remove(id, scope, context); }

  async unreadNotificationCount(scope) {
    const count = await Notification.countDocuments({ ...scope, deletedAt: null, readAt: null });
    return { count };
  }

  async markNotificationRead(id, scope, context) {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, ...scope, deletedAt: null },
      { $set: { readAt: new Date(), updatedBy: context.actorId } },
      { new: true },
    );
    if (!notification) throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    return notification;
  }

  async markAllNotificationsRead(scope, context) {
    const readAt = new Date();
    const result = await Notification.updateMany(
      { ...scope, deletedAt: null, readAt: null },
      { $set: { readAt, updatedBy: context.actorId } },
    );
    return { updatedCount: result.modifiedCount, readAt };
  }

  createResource(name, input, context) {
    if (name === 'merchants') return this.onboardMerchant(input, context);
    if (name === 'drivers') return this.onboardDriver(input, context);
    if (name === 'hubs') {
      const hub = this.prepareHubInput(input, { create: true });
      return this.resource(name).create(hub, { ...context, hubId: hub.hubId });
    }
    return this.resource(name).create(input, context);
  }

  prepareHubInput(input, { create = false } = {}) {
    const codeValue = input.code || (create ? generatedCode('HUB') : undefined);
    const point = input.location?.type === 'Point' ? input.location : input.coordinates?.lat !== undefined && input.coordinates?.lng !== undefined ? { type: 'Point', coordinates: [Number(input.coordinates.lng), Number(input.coordinates.lat)] } : undefined;
    return {
      ...(codeValue ? { code: codeValue, hubId: codeValue } : {}),
      ...(create ? { slug: input.slug || `${String(input.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${randomBytes(2).toString('hex')}` } : {}),
      name: input.name, address: typeof input.location === 'string' ? input.location : input.address, city: input.city, region: input.region,
      zoneCoverage: input.zone ? [input.zone] : input.zoneCoverage, phone: input.phone, email: input.email, dailyTarget: input.dailyTarget,
      ...(point ? { location: point } : {}),
      ...(input.status ? { status: String(input.status).toUpperCase().replaceAll(' ', '_') } : {}),
    };
  }

  prepareDriverUpdate(input) {
    const allowed = Object.fromEntries(Object.entries(input).filter(([key]) => ['name', 'phone', 'email', 'stage', 'yearsExperience', 'district', 'division', 'stageChairmanContact', 'nextOfKin', 'plateNumber', 'nationalId', 'availability', 'autoAccept', 'securityBond', 'zones', 'status'].includes(key)));
    if (input.locked !== undefined) allowed.status = input.locked ? 'SUSPENDED' : 'ACTIVE';
    if (allowed.availability) allowed.availability = String(allowed.availability).toUpperCase().replaceAll(' ', '_');
    if (allowed.status) allowed.status = String(allowed.status).toUpperCase().replaceAll(' ', '_');
    return allowed;
  }

  async resolveHubId(candidate) {
    if (typeof candidate === 'string' && /^HUB_[A-Z0-9_]+$/.test(candidate)) return candidate;
    if (!mongoose.isValidObjectId(candidate)) throw new AppError('A valid operational hub is required', 422, 'INVALID_HUB');
    const hub = await Hub.findOne({ _id: candidate, deletedAt: null }).select('hubId').lean();
    if (!hub) throw new AppError('Hub not found', 404, 'HUB_NOT_FOUND');
    return hub.hubId;
  }

  async onboardMerchant(input, context) {
    const hubId = await this.resolveHubId(input.hubId ?? context.hubId);
    if (!hubId) throw new AppError('A hub is required', 422, 'HUB_REQUIRED');
    if (!input.password) throw new AppError('A temporary password is required', 422, 'PASSWORD_REQUIRED');
    return withTransaction(async (session) => {
      const user = await User.create([{
        hubId, name: input.ownerName || input.businessName, email: input.email || undefined, phone: input.phone,
        passwordHash: await AuthService.hashPassword(input.password), role: ROLES.MERCHANT, status: 'ACTIVE',
        createdBy: context.actorId, updatedBy: context.actorId,
      }], { session }).then(([document]) => document);
      const merchant = await Merchant.create([{
        hubId, userId: user._id, merchantCode: generatedCode('MER'), businessName: input.businessName, shopName: input.shopName,
        building: input.building ?? input.buildingName, phone: input.phone, email: input.email || undefined, ownerName: input.ownerName,
        address: input.address, tier: String(input.tier ?? input.startingLevel ?? 'STARTER').toUpperCase(), referralCode: input.referralCode,
        status: 'ACTIVE', createdBy: context.actorId, updatedBy: context.actorId,
      }], { session }).then(([document]) => document);
      user.merchantId = merchant._id;
      await user.save({ session });
      return merchant;
    });
  }

  async onboardDriver(input, context) {
    const hubId = await this.resolveHubId(input.hubId ?? context.hubId);
    if (!hubId) throw new AppError('A hub is required', 422, 'HUB_REQUIRED');
    if (!input.password && !input.pin) throw new AppError('A temporary password or PIN is required', 422, 'PASSWORD_REQUIRED');
    await this.assertDriverIdentityAvailable(input);
    return withTransaction(async (session) => {
      const user = await User.create([{
        hubId, name: input.name, email: input.email || undefined, phone: input.phone,
        passwordHash: input.password ? await AuthService.hashPassword(input.password) : undefined,
        pinHash: input.pin ? await AuthService.hashPassword(input.pin) : undefined,
        role: ROLES.DRIVER, status: 'ACTIVE', createdBy: context.actorId, updatedBy: context.actorId,
      }], { session }).then(([document]) => document);
      const driver = await Driver.create([{
        hubId, userId: user._id, driverCode: generatedCode('DRV'), name: input.name, phone: input.phone, email: input.email || undefined,
        plateNumber: input.plateNumber, nationalId: input.nationalId, stage: input.stage ?? input.specificStage,
        yearsExperience: Number(input.yearsExperience || 0), district: input.district, division: input.division, stageChairmanContact: input.stageChairmanContact,
        nextOfKin: input.nextOfKin, availability: 'OFFLINE', status: input.legalAccepted ? 'PENDING_KYC' : 'PENDING_LEGAL',
        createdBy: context.actorId, updatedBy: context.actorId,
      }], { session }).then(([document]) => document);
      if (input.vehicleType && input.plateNumber) {
        const vehicleType = /bicycle/i.test(input.vehicleType) ? 'BICYCLE' : /car|van|voiture/i.test(input.vehicleType) ? 'VAN' : 'MOTORCYCLE';
        const vehicle = await Vehicle.create([{
          hubId, driverId: driver._id, type: vehicleType, plateNumber: input.plateNumber, status: 'ACTIVE', createdBy: context.actorId, updatedBy: context.actorId,
        }], { session }).then(([document]) => document);
        driver.vehicleId = vehicle._id;
        await driver.save({ session });
      }
      user.driverId = driver._id;
      await user.save({ session });
      return driver;
    });
  }

  async driverIdentityAvailability(input) {
    const email = input.email?.trim().toLowerCase();
    const phone = input.phone?.trim();
    const plateNumber = input.plateNumber?.trim().toUpperCase();
    const userMatches = [email ? { email } : null, phone ? { phone } : null].filter(Boolean);
    const [existingUser, existingVehicle] = await Promise.all([
      userMatches.length ? User.findOne({ deletedAt: null, $or: userMatches }).select('email phone').lean() : null,
      plateNumber ? Vehicle.findOne({ plateNumber }).select('_id').lean() : null,
    ]);
    const conflicts = [];
    if (email && existingUser?.email === email) conflicts.push({ field: 'email', message: 'This email is already assigned to another account' });
    if (phone && existingUser?.phone === phone) conflicts.push({ field: 'phone', message: 'This phone number is already assigned to another account' });
    if (existingVehicle) conflicts.push({ field: 'plateNumber', message: 'This vehicle plate is already assigned to another driver' });
    return { available: conflicts.length === 0, conflicts };
  }

  async assertDriverIdentityAvailable(input) {
    const availability = await this.driverIdentityAvailability(input);
    const conflict = availability.conflicts[0];
    if (!conflict) return;
    const codes = { email: 'DRIVER_EMAIL_IN_USE', phone: 'DRIVER_PHONE_IN_USE', plateNumber: 'DRIVER_PLATE_IN_USE' };
    throw new AppError(conflict.message, 409, codes[conflict.field], { field: conflict.field });
  }

  async createUser(input, context) {
    const { password, pin, ...data } = input;
    return User.create({
      ...data, hubId: data.hubId ?? context.hubId,
      passwordHash: password ? await AuthService.hashPassword(password) : undefined,
      pinHash: pin ? await AuthService.hashPassword(pin) : undefined,
      status: 'ACTIVE', createdBy: context.actorId, updatedBy: context.actorId,
    });
  }
}

export class PublicPortalService {
  async track(token) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const order = await Order.findOne({ publicTrackingTokenHash: tokenHash, deletedAt: null })
      .select('hubId orderNumber orderStatus driverId packageId riderTrackingId packageTrackingId timeline delivery deliveredAt')
      .populate('driverId', 'name rating')
      .lean();
    if (!order) throw new AppError('Tracking link not found', 404, 'TRACKING_NOT_FOUND');
    return order;
  }

  submitRating(input) {
    return Rating.create({ ...input, hubId: input.hubId, status: 'ACTIVE', createdBy: SYSTEM_ACTOR_ID, updatedBy: SYSTEM_ACTOR_ID });
  }
}
