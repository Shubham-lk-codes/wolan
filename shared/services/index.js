import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { LIMITS, normalizeRole, ORDER_STATUS, SYSTEM_ACTOR_ID, SYSTEM_ROLES } from '../constants/index.js';
import { SOCKET_EVENTS } from '../events/index.js';
import { COD, CustodyEvent, DeliveryProof, Driver, Incident, Notification, Order, OTP, OutboxEvent, Package, Payment, SecurityAlert, Session, Tracking, User } from '../models/index.js';
import { BaseRepository, withTransaction } from '../repositories/index.js';
import { AppError } from '../utils/index.js';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const secureToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
const code = (prefix) => `${prefix}_${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString('hex').toUpperCase()}`;
const durationMs = (value, fallback) => {
  const match = /^(\d+)(s|m|h|d)$/i.exec(String(value ?? ''));
  if (!match) return fallback;
  const units = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * units[match[2].toLowerCase()];
};
const publicUser = (user) => {
  const value = user.toJSON ? user.toJSON() : { ...user };
  for (const field of ['passwordHash', 'pinHash', 'refreshTokenHash', 'tokenVersion', 'failedLoginCount', 'lockedUntil']) delete value[field];
  return value;
};

async function publishOutbox(eventDocument, publisher) {
  if (!eventDocument || !publisher) return;
  const claimed = await OutboxEvent.findOneAndUpdate(
    { _id: eventDocument._id, processedAt: null, $or: [{ status: { $ne: 'PROCESSING' } }, { updatedAt: { $lt: new Date(Date.now() - 60_000) } }] },
    { $set: { status: 'PROCESSING', updatedAt: new Date() } },
    { new: true },
  );
  if (!claimed) return;
  try {
    await publisher(claimed.eventType, claimed.payload);
    await OutboxEvent.updateOne(
      { _id: claimed._id, processedAt: null },
      { $set: { processedAt: new Date(), status: 'PROCESSED' }, $inc: { attempts: 1 } },
    );
  } catch (error) {
    await OutboxEvent.updateOne(
      { _id: claimed._id, processedAt: null },
      { $set: { lastError: error.message, status: 'PENDING' }, $inc: { attempts: 1 } },
    );
  }
}

export class AuthService {
  constructor(config) {
    this.config = {
      accessExpiresIn: '15m', refreshExpiresIn: '30d', issuer: 'wolan-logistics', audience: 'wolan-platform',
      ...config,
    };
    if (!this.config.accessSecret || !this.config.refreshSecret) throw new Error('JWT access and refresh secrets are required');
  }

  signAccess(user) {
    return jwt.sign({ typ: 'access', userId: user._id.toString(), role: normalizeRole(user.role), hubId: user.hubId, ver: user.tokenVersion ?? 0 }, this.config.accessSecret, {
      subject: user._id.toString(), expiresIn: this.config.accessExpiresIn, issuer: this.config.issuer, audience: this.config.audience,
    });
  }

  signRefresh(user, sessionId, familyId) {
    return jwt.sign({ typ: 'refresh', sid: sessionId.toString(), family: familyId, ver: user.tokenVersion ?? 0 }, this.config.refreshSecret, {
      subject: user._id.toString(), expiresIn: this.config.refreshExpiresIn, issuer: this.config.issuer, audience: this.config.audience,
    });
  }

  async login({ identifier, password }, metadata = {}) {
    const normalized = identifier.trim().toLowerCase();
    const user = await User.findOne({ $or: [{ email: normalized }, { phone: identifier.trim() }], deletedAt: null, status: 'ACTIVE' }).select('+passwordHash +pinHash +tokenVersion +failedLoginCount +lockedUntil');
    if (!user || (user.lockedUntil && user.lockedUntil > new Date())) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    const hash = user.passwordHash || user.pinHash;
    const valid = hash ? await bcrypt.compare(password, hash) : false;
    if (!valid) {
      user.failedLoginCount = (user.failedLoginCount ?? 0) + 1;
      if (user.failedLoginCount >= 5) user.lockedUntil = new Date(Date.now() + 15 * 60_000);
      await user.save();
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }
    user.role = normalizeRole(user.role);
    if (!SYSTEM_ROLES.includes(user.role)) throw new AppError('Account role is not supported', 403, 'ROLE_NOT_SUPPORTED');
    const familyId = randomUUID();
    const placeholder = secureToken();
    const session = await Session.create({ hubId: user.hubId, userId: user._id, refreshTokenHash: sha256(placeholder), familyId, userAgent: metadata.userAgent, ip: metadata.ip, expiresAt: new Date(Date.now() + durationMs(this.config.refreshExpiresIn, 30 * 86_400_000)), status: 'ACTIVE', createdBy: user._id, updatedBy: user._id });
    const refreshToken = this.signRefresh(user, session._id, familyId);
    session.refreshTokenHash = sha256(refreshToken);
    await session.save();
    user.failedLoginCount = 0; user.lockedUntil = undefined; user.lastLoginAt = new Date();
    await user.save();
    return { accessToken: this.signAccess(user), refreshToken, user: publicUser(user) };
  }

  async refresh(refreshToken, metadata = {}) {
    let payload;
    try { payload = jwt.verify(refreshToken, this.config.refreshSecret, { issuer: this.config.issuer, audience: this.config.audience }); }
    catch { throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN'); }
    if (payload.typ !== 'refresh') throw new AppError('Invalid refresh token type', 401, 'INVALID_REFRESH_TOKEN');
    const session = await Session.findOne({ _id: payload.sid, userId: payload.sub, familyId: payload.family }).select('+refreshTokenHash');
    const presented = Buffer.from(sha256(refreshToken));
    const stored = Buffer.from(session?.refreshTokenHash ?? '');
    if (!session || session.revokedAt || session.expiresAt <= new Date() || stored.length !== presented.length || !timingSafeEqual(stored, presented)) {
      if (payload.family) await Session.updateMany({ familyId: payload.family, revokedAt: null }, { $set: { revokedAt: new Date(), status: 'REVOKED' } });
      throw new AppError('Refresh token reuse or invalid session detected', 401, 'REFRESH_REUSE_DETECTED');
    }
    const user = await User.findOne({ _id: payload.sub, deletedAt: null, status: 'ACTIVE' }).select('+tokenVersion');
    if (!user || user.tokenVersion !== payload.ver) throw new AppError('Session revoked', 401, 'SESSION_REVOKED');
    user.role = normalizeRole(user.role);
    if (!SYSTEM_ROLES.includes(user.role)) throw new AppError('Account role is not supported', 403, 'ROLE_NOT_SUPPORTED');
    const replacement = await Session.create({ hubId: session.hubId, userId: user._id, refreshTokenHash: sha256(secureToken()), familyId: session.familyId, userAgent: metadata.userAgent, ip: metadata.ip, expiresAt: new Date(Date.now() + durationMs(this.config.refreshExpiresIn, 30 * 86_400_000)), status: 'ACTIVE', createdBy: user._id, updatedBy: user._id });
    const nextRefresh = this.signRefresh(user, replacement._id, session.familyId);
    replacement.refreshTokenHash = sha256(nextRefresh);
    await replacement.save();
    session.revokedAt = new Date(); session.replacedBySessionId = replacement._id; session.status = 'ROTATED';
    await session.save();
    return { accessToken: this.signAccess(user), refreshToken: nextRefresh, user: publicUser(user) };
  }

  async logout(refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, this.config.refreshSecret, { issuer: this.config.issuer, audience: this.config.audience });
      await Session.updateOne({ _id: payload.sid, userId: payload.sub }, { $set: { revokedAt: new Date(), status: 'REVOKED' } });
    } catch { /* Logout is intentionally idempotent. */ }
  }

  async requestCredentialReset({ identifier }) {
    const normalized = identifier.trim().toLowerCase();
    const user = await User.findOne({ $or: [{ email: normalized }, { phone: identifier.trim() }], deletedAt: null, status: 'ACTIVE' });
    if (!user) return { accepted: true, otpId: new mongoose.Types.ObjectId(), expiresAt: new Date(Date.now() + 10 * 60_000) };
    const codeValue = String(Math.floor(100000 + Math.random() * 900000));
    const otp = await OTP.create({
      hubId: user.hubId, purpose: 'PASSWORD_RESET', recipient: user.phone || user.email, codeHash: sha256(codeValue), entityId: user._id,
      expiresAt: new Date(Date.now() + 10 * 60_000), status: 'ACTIVE', createdBy: SYSTEM_ACTOR_ID, updatedBy: SYSTEM_ACTOR_ID,
    });
    await Notification.create({
      hubId: user.hubId, recipientType: 'USER', recipientId: user._id, title: 'Credential reset requested',
      message: 'A credential reset code was requested. The configured messaging provider must deliver the protected OTP.',
      channels: user.phone ? ['SMS'] : ['EMAIL'], status: 'PENDING', createdBy: SYSTEM_ACTOR_ID, updatedBy: SYSTEM_ACTOR_ID,
      metadata: { otpId: otp._id, expiresAt: otp.expiresAt },
    });
    await this.config.credentialResetPublisher?.({ recipient: otp.recipient, code: codeValue, otpId: otp._id, expiresAt: otp.expiresAt });
    return { accepted: true, otpId: otp._id, expiresAt: otp.expiresAt };
  }

  async resetCredential({ otpId, code: codeValue, credential, pin = false }) {
    return withTransaction(async (session) => {
      const otp = await OTP.findOne({ _id: otpId, purpose: 'PASSWORD_RESET', consumedAt: null, expiresAt: { $gt: new Date() }, deletedAt: null }).select('+codeHash').session(session);
      if (!otp || otp.attempts >= otp.maxAttempts) throw new AppError('Reset code is invalid or expired', 422, 'INVALID_RESET_CODE');
      const expected = Buffer.from(otp.codeHash); const actual = Buffer.from(sha256(codeValue));
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) { otp.attempts += 1; await otp.save({ session }); throw new AppError('Reset code is invalid or expired', 422, 'INVALID_RESET_CODE'); }
      const user = await User.findOne({ _id: otp.entityId, hubId: otp.hubId, deletedAt: null }).select('+tokenVersion').session(session);
      if (!user) throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');
      if (pin) user.pinHash = await AuthService.hashPassword(credential); else user.passwordHash = await AuthService.hashPassword(credential);
      user.tokenVersion = (user.tokenVersion ?? 0) + 1; user.passwordChangedAt = new Date(); user.updatedBy = user._id;
      otp.consumedAt = new Date(); otp.status = 'CONSUMED'; otp.updatedBy = user._id;
      await Promise.all([user.save({ session }), otp.save({ session }), Session.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date(), status: 'REVOKED', updatedBy: user._id } }, { session })]);
      return { changed: true };
    });
  }

  async changePin(userId, currentPin, nextPin) {
    const user = await User.findOne({ _id: userId, deletedAt: null, status: 'ACTIVE' }).select('+pinHash +tokenVersion');
    if (!user?.pinHash || !await bcrypt.compare(currentPin, user.pinHash)) throw new AppError('Current PIN is incorrect', 401, 'INVALID_CREDENTIALS');
    user.pinHash = await AuthService.hashPassword(nextPin); user.tokenVersion = (user.tokenVersion ?? 0) + 1; user.passwordChangedAt = new Date(); user.updatedBy = user._id;
    await user.save();
    await Session.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date(), status: 'REVOKED', updatedBy: user._id } });
    return { changed: true };
  }

  static async hashPassword(value) { return bcrypt.hash(value, 12); }
}

export class PricingService {
  quote({ distanceKm = 0, codAmount = 0, insurance = false, serviceType = 'STANDARD' }) {
    const baseFee = serviceType === 'EXPRESS' ? 8_000 : 5_000;
    const distanceFee = Math.max(0, Math.ceil(distanceKm) * 1_000);
    const codFee = Math.round(codAmount * LIMITS.COD_SERVICE_PERCENT / 100);
    const insuranceFee = insurance ? LIMITS.INSURANCE_FEE_UGX : 0;
    return { baseFee, distanceFee, codFee, insuranceFee, returnFee: 0, total: baseFee + distanceFee + codFee + insuranceFee, currency: 'UGX' };
  }
}

export class OrderService {
  constructor({ eventPublisher, pricingService = new PricingService() } = {}) {
    this.orders = new BaseRepository(Order, {
      searchFields: ['orderNumber', 'customer.name', 'customer.phone', 'itemDescription'],
      filterFields: ['status', 'orderStatus', 'merchantId', 'driverId'],
      sortFields: ['createdAt', 'updatedAt', 'orderStatus', 'deliveredAt'],
      populates: [{ path: 'merchantId', select: 'businessName shopName merchantCode phone' }, { path: 'driverId', select: 'name phone driverCode availability rating' }],
    });
    this.eventPublisher = eventPublisher;
    this.pricingService = pricingService;
  }

  list(scope, query) { return this.orders.list(scope, query); }
  get(id, scope) { return this.orders.findById(id, scope); }
  quote(input) { return this.pricingService.quote(input); }

  async create(input, context) {
    const publicTrackingToken = secureToken();
    const pickupSecret = String(Math.floor(100000 + Math.random() * 900000));
    const { distanceKm: _distanceKm, serviceType: _serviceType, packageSize = 'MEDIUM', insurance = false, ...orderInput } = input;
    const pricing = this.pricingService.quote(input);
    const result = await withTransaction(async (session) => {
      const order = await this.orders.create({
        ...orderInput,
        orderNumber: code('WOL'),
        status: 'ACTIVE',
        orderStatus: ORDER_STATUS.PENDING,
        pricing,
        insurance: { enabled: insurance, fee: pricing.insuranceFee, coverageAmount: insurance ? Math.min(input.declaredValue ?? 0, LIMITS.INSURANCE_COVER_LIMIT_UGX) : 0 },
        riderTrackingId: code('RTRK'),
        packageTrackingId: code('PTRK'),
        publicTrackingTokenHash: sha256(publicTrackingToken),
        pickupSecretHash: sha256(pickupSecret),
        timeline: [{ status: ORDER_STATUS.PENDING, note: 'Order created', actorId: context.actorId, at: new Date() }],
      }, context, session);
      const packageDocument = await Package.create([{
        hubId: context.hubId, createdBy: context.actorId, updatedBy: context.actorId, status: 'ACTIVE', packageTrackingId: order.packageTrackingId,
        orderId: order._id, description: input.itemDescription, size: packageSize, custodyStatus: 'AT_MERCHANT',
      }], { session }).then(([document]) => document);
      order.packageId = packageDocument._id;
      await order.save({ session });
      const outboxEvent = await OutboxEvent.create([{
        hubId: context.hubId, createdBy: context.actorId, updatedBy: context.actorId, status: 'PENDING', eventId: randomUUID(), eventType: SOCKET_EVENTS.ORDER_CREATED,
        aggregateType: 'Order', aggregateId: order._id, payload: { orderId: order._id, hubId: context.hubId, merchantId: order.merchantId },
      }], { session }).then(([document]) => document);
      const notifications = await Notification.create([
        {
          hubId: context.hubId, recipientType: 'HUB', title: 'New order', message: `${order.orderNumber} entered the hub dispatch queue.`,
          channels: ['IN_APP'], priority: 'NORMAL', metadata: { category: 'NEW_ORDER', orderId: order._id }, status: 'SENT', sentAt: new Date(),
          createdBy: context.actorId, updatedBy: context.actorId,
        },
        ...(Number(order.codAmount || 0) > 0 ? [{
          hubId: context.hubId, recipientType: 'HUB', title: 'COD alert', message: `${order.orderNumber} carries UGX ${Number(order.codAmount).toLocaleString()} COD.`,
          channels: ['IN_APP'], priority: 'HIGH', metadata: { category: 'COD_ALERT', orderId: order._id, amount: order.codAmount }, status: 'SENT', sentAt: new Date(),
          createdBy: context.actorId, updatedBy: context.actorId,
        }] : []),
      ], { session });
      return { order, package: packageDocument, outboxEvent, notifications };
    });
    await publishOutbox(result.outboxEvent, this.eventPublisher);
    await Promise.all(result.notifications.map((notification) => this.eventPublisher?.(SOCKET_EVENTS.NEW_NOTIFICATION, notification.toJSON())));
    const { outboxEvent: _outboxEvent, notifications: _notifications, ...response } = result;
    return { ...response, publicTrackingToken, pickupSecret };
  }

  async assign(orderId, driverId, scope, context) {
    const result = await withTransaction(async (session) => {
      const [order, driver] = await Promise.all([
        Order.findOne({ _id: orderId, ...scope, deletedAt: null }).session(session),
        Driver.findOne({ _id: driverId, ...scope, deletedAt: null, status: 'ACTIVE' }).session(session),
      ]);
      if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      if (!order.pickupVerifiedAt || !order.hubScannedAt) throw new AppError('Merchant handover and hub scan are required before assignment', 409, 'HUB_SCAN_REQUIRED');
      if (!driver || driver.availability !== 'AVAILABLE') throw new AppError('Driver is not available', 409, 'DRIVER_UNAVAILABLE');
      if (driver.codHeld + order.codAmount > LIMITS.RIDER_COD_UGX) throw new AppError('Driver COD limit would be exceeded', 409, 'COD_LIMIT_EXCEEDED');
      order.driverId = driver._id; order.orderStatus = ORDER_STATUS.ASSIGNED; order.assignedAt = new Date(); order.updatedBy = context.actorId;
      order.timeline.push({ status: ORDER_STATUS.ASSIGNED, note: 'Driver assigned', actorId: context.actorId, at: new Date() });
      driver.availability = 'ON_DELIVERY'; driver.updatedBy = context.actorId;
      const [, , events] = await Promise.all([order.save({ session }), driver.save({ session }), OutboxEvent.create([{
        hubId: order.hubId, createdBy: context.actorId, updatedBy: context.actorId, status: 'PENDING', eventId: randomUUID(), eventType: SOCKET_EVENTS.ORDER_ASSIGNED,
        aggregateType: 'Order', aggregateId: order._id, payload: { orderId: order._id, driverId: driver._id, hubId: order.hubId },
      }], { session })]);
      return { order, outboxEvent: events[0] };
    });
    await publishOutbox(result.outboxEvent, this.eventPublisher);
    return result.order;
  }

  async verifyPickup(orderId, secret, scope, context) {
    const order = await Order.findOne({ _id: orderId, ...scope, deletedAt: null }).select('+pickupSecretHash');
    if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    const expected = Buffer.from(order.pickupSecretHash ?? '');
    const actual = Buffer.from(sha256(String(secret)));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new AppError('Pickup key is invalid', 422, 'INVALID_PICKUP_KEY');
    order.pickupVerifiedAt = order.pickupVerifiedAt ?? new Date();
    order.updatedBy = context.actorId;
    order.timeline.push({ status: order.orderStatus, note: 'Merchant handover key verified', actorId: context.actorId, at: new Date() });
    await order.save();
    return order;
  }

  async scanAtHub(orderId, packageTrackingId, scope, context) {
    return withTransaction(async (session) => {
      const order = await Order.findOne({ _id: orderId, ...scope, deletedAt: null }).session(session);
      if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      if (!order.pickupVerifiedAt) throw new AppError('Merchant handover must be verified first', 409, 'HANDOVER_REQUIRED');
      if (order.packageTrackingId !== String(packageTrackingId).trim().toUpperCase()) throw new AppError('Package does not match this order', 409, 'PACKAGE_MISMATCH');
      const packageDocument = await Package.findOne({ _id: order.packageId, hubId: order.hubId, deletedAt: null }).session(session);
      if (!packageDocument) throw new AppError('Package not found', 404, 'PACKAGE_NOT_FOUND');
      const firstScan = !order.hubScannedAt;
      order.hubScannedAt = order.hubScannedAt ?? new Date();
      order.updatedBy = context.actorId;
      order.timeline.push({ status: order.orderStatus, note: 'Package scanned into hub', actorId: context.actorId, at: new Date() });
      packageDocument.custodyStatus = 'AT_HUB';
      packageDocument.updatedBy = context.actorId;
      await Promise.all([order.save({ session }), packageDocument.save({ session })]);
      if (firstScan) await CustodyEvent.create([{
        hubId: order.hubId, createdBy: context.actorId, updatedBy: context.actorId, status: 'ACTIVE', orderId: order._id, packageId: packageDocument._id,
        fromType: 'MERCHANT', fromId: order.merchantId, toType: 'HUB', scanCode: order.packageTrackingId, occurredAt: new Date(),
      }], { session });
      return order;
    });
  }

  async markMerchantSendOff(orderId, scope, context) {
    const result = await withTransaction(async (session) => {
      const order = await Order.findOne({ _id: orderId, ...scope, deletedAt: null }).session(session);
      if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      if ([ORDER_STATUS.DELIVERED, ORDER_STATUS.RETURNED, ORDER_STATUS.CANCELLED].includes(order.orderStatus)) throw new AppError('This order can no longer be sent off', 409, 'ORDER_CLOSED');
      order.merchantSentOffAt = order.merchantSentOffAt ?? new Date();
      order.updatedBy = context.actorId;
      order.timeline.push({ status: order.orderStatus, note: 'Merchant marked package ready for pickup', actorId: context.actorId, at: new Date() });
      await order.save({ session });
      const outboxEvent = await OutboxEvent.create([{
        hubId: order.hubId, createdBy: context.actorId, updatedBy: context.actorId, status: 'PENDING', eventId: randomUUID(), eventType: SOCKET_EVENTS.ORDER_STATUS_CHANGED,
        aggregateType: 'Order', aggregateId: order._id, payload: { orderId: order._id, hubId: order.hubId, merchantId: order.merchantId, status: order.orderStatus, merchantSentOffAt: order.merchantSentOffAt },
      }], { session }).then(([document]) => document);
      const notification = nextStatus === ORDER_STATUS.FAILED ? await Notification.create([{
        hubId: order.hubId, recipientType: 'HUB', title: 'Failed delivery', message: `${order.orderNumber} was marked failed${note ? `: ${note}` : '.'}`,
        channels: ['IN_APP'], priority: 'HIGH', metadata: { category: 'FAILED_DELIVERY', orderId: order._id, driverId: order.driverId }, status: 'SENT', sentAt: new Date(),
        createdBy: context.actorId, updatedBy: context.actorId,
      }], { session }).then(([document]) => document) : null;
      return { order, outboxEvent, notification };
    });
    await publishOutbox(result.outboxEvent, this.eventPublisher);
    if (result.notification) await this.eventPublisher?.(SOCKET_EVENTS.NEW_NOTIFICATION, result.notification.toJSON());
    return result.order;
  }

  async transition(orderId, nextStatus, scope, context, note) {
    const allowed = {
      [ORDER_STATUS.PENDING]: [ORDER_STATUS.ASSIGNED, ORDER_STATUS.CANCELLED],
      [ORDER_STATUS.ASSIGNED]: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PENDING, ORDER_STATUS.CANCELLED],
      [ORDER_STATUS.ACCEPTED]: [ORDER_STATUS.PICKED_UP, ORDER_STATUS.FAILED],
      [ORDER_STATUS.PICKED_UP]: [ORDER_STATUS.AT_HUB, ORDER_STATUS.FAILED],
      [ORDER_STATUS.AT_HUB]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.RETURN_REQUESTED],
      [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FAILED],
      [ORDER_STATUS.FAILED]: [ORDER_STATUS.RETURN_REQUESTED, ORDER_STATUS.OUT_FOR_DELIVERY],
      [ORDER_STATUS.RETURN_REQUESTED]: [ORDER_STATUS.RETURNED],
    };
    const result = await withTransaction(async (session) => {
      const order = await Order.findOne({ _id: orderId, ...scope, deletedAt: null }).session(session);
      if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      if (!(allowed[order.orderStatus] ?? []).includes(nextStatus)) throw new AppError(`Cannot transition from ${order.orderStatus} to ${nextStatus}`, 409, 'INVALID_ORDER_TRANSITION');
      order.orderStatus = nextStatus; order.updatedBy = context.actorId;
      order.timeline.push({ status: nextStatus, note, actorId: context.actorId, at: new Date() });
      const timestampField = { ASSIGNED: 'assignedAt', ACCEPTED: 'acceptedAt', PICKED_UP: 'pickedUpAt', AT_HUB: 'atHubAt', OUT_FOR_DELIVERY: 'outForDeliveryAt', DELIVERED: 'deliveredAt', FAILED: 'failedAt', RETURNED: 'returnedAt', CANCELLED: 'cancelledAt' }[nextStatus];
      if (timestampField) order[timestampField] = new Date();
      await order.save({ session });
      const eventType = nextStatus === ORDER_STATUS.DELIVERED ? SOCKET_EVENTS.ORDER_DELIVERED : SOCKET_EVENTS.ORDER_STATUS_CHANGED;
      const outboxEvent = await OutboxEvent.create([{
        hubId: order.hubId, createdBy: context.actorId, updatedBy: context.actorId, status: 'PENDING', eventId: randomUUID(), eventType,
        aggregateType: 'Order', aggregateId: order._id, payload: { orderId: order._id, hubId: order.hubId, driverId: order.driverId, merchantId: order.merchantId, status: nextStatus },
      }], { session }).then(([document]) => document);
      return { order, outboxEvent };
    });
    await publishOutbox(result.outboxEvent, this.eventPublisher);
    return result.order;
  }
}

export class OutboxService {
  constructor({ eventPublisher } = {}) { this.eventPublisher = eventPublisher; }

  async drain({ limit = 100 } = {}) {
    const events = await OutboxEvent.find({ processedAt: null, availableAt: { $lte: new Date() }, deletedAt: null }).sort({ availableAt: 1, _id: 1 }).limit(Math.min(500, Math.max(1, limit)));
    for (const event of events) await publishOutbox(event, this.eventPublisher);
    return events.length;
  }
}

function distanceMetres(a, b) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const [lng1, lat1] = a.coordinates; const [lng2, lat2] = b.coordinates;
  const dLat = radians(lat2 - lat1); const dLng = radians(lng2 - lng1);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export class TrackingService {
  constructor({ eventPublisher } = {}) { this.eventPublisher = eventPublisher; }
  async record(input, context) {
    const actorId = context.actorId ?? SYSTEM_ACTOR_ID;
    const sample = await Tracking.create({ ...input, hubId: context.hubId, createdBy: actorId, updatedBy: actorId, status: 'ACTIVE' });
    const event = input.entityType === 'DRIVER' ? SOCKET_EVENTS.DRIVER_LOCATION : SOCKET_EVENTS.PACKAGE_LOCATION;
    await this.eventPublisher?.(event, { ...input, hubId: context.hubId, trackingId: sample._id });
    if (input.orderId) await this.detectMismatch(input.orderId, context);
    return sample;
  }

  async detectMismatch(orderId, context) {
    const actorId = context.actorId ?? SYSTEM_ACTOR_ID;
    const latest = await Tracking.aggregate([
      { $match: { hubId: context.hubId, orderId: new mongoose.Types.ObjectId(orderId), deletedAt: null } },
      { $sort: { recordedAt: -1 } },
      { $group: { _id: '$entityType', sample: { $first: '$$ROOT' } } },
    ]);
    const driver = latest.find((item) => item._id === 'DRIVER')?.sample;
    const packageSample = latest.find((item) => item._id === 'PACKAGE')?.sample;
    if (!driver || !packageSample) return null;
    const separation = distanceMetres(driver.location, packageSample.location);
    if (separation < LIMITS.TRACKER_MISMATCH_METRES) return null;
    const existing = await SecurityAlert.findOne({ hubId: context.hubId, orderId, type: 'PACKAGE_MISMATCH', status: 'OPEN', deletedAt: null });
    if (existing) return existing;
    const alert = await SecurityAlert.create({ hubId: context.hubId, createdBy: actorId, updatedBy: actorId, status: 'OPEN', type: 'PACKAGE_MISMATCH', severity: 'CRITICAL', orderId, details: { separationMetres: Math.round(separation) } });
    await this.eventPublisher?.(SOCKET_EVENTS.PACKAGE_MISMATCH, { hubId: context.hubId, orderId, separationMetres: Math.round(separation), alertId: alert._id });
    return alert;
  }
}

export class CODService {
  async exposure(scope) {
    const [result] = await COD.aggregate([{ $match: { ...scope, deletedAt: null, status: { $in: ['PENDING', 'COLLECTED'] } } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]);
    return { amount: result?.total ?? 0, count: result?.count ?? 0, limit: LIMITS.FIELD_COD_UGX, warning: (result?.total ?? 0) >= LIMITS.FIELD_COD_UGX };
  }
}

export class NotificationService {
  constructor({ eventPublisher } = {}) { this.eventPublisher = eventPublisher; }
  async create(input, context, session) {
    const isInApp = input.channels?.includes('IN_APP');
    const notification = await Notification.create([{
      ...input,
      hubId: context.hubId,
      createdBy: context.actorId,
      updatedBy: context.actorId,
      status: isInApp ? 'SENT' : 'PENDING',
      ...(isInApp ? { sentAt: new Date() } : {}),
    }], { session }).then(([item]) => item);
    if (!session) await this.eventPublisher?.(SOCKET_EVENTS.NEW_NOTIFICATION, notification.toJSON());
    return notification;
  }
}

export class CrudService {
  constructor(model, repositoryOptions) { this.repository = new BaseRepository(model, repositoryOptions); }
  list(scope, query) { return this.repository.list(scope, query); }
  get(id, scope) { return this.repository.findById(id, scope); }
  create(data, context) { return this.repository.create(data, context); }
  update(id, scope, data, context) { return this.repository.updateById(id, scope, data, context); }
  remove(id, scope, context) { return this.repository.softDeleteById(id, scope, context); }
}

export const serviceModels = Object.freeze({ CustodyEvent, DeliveryProof, Incident, Payment });

export { AdminPortalService, PublicPortalService } from './admin.js';
export { MerchantPortalService } from './merchant.js';
export { DriverPortalService } from './driver.js';
export { UploadService } from './upload.js';
