import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  AuditLog, COD, CustodyEvent, DeliveryProof, Driver, DriverEarning, FinePenalty, GPSDevice, Incident, Notification, Order, OTP, OutboxEvent, Package,
} from '../models/index.js';
import { LIMITS, ORDER_STATUS } from '../constants/index.js';
import { SOCKET_EVENTS } from '../events/index.js';
import { withTransaction } from '../repositories/index.js';
import { AppError, paginationMeta, parsePagination } from '../utils/index.js';
import { OrderService, OutboxService, TrackingService } from './index.js';

export class DriverPortalService {
  constructor({ eventPublisher } = {}) {
    this.eventPublisher = eventPublisher;
    this.orders = new OrderService({ eventPublisher });
    this.tracking = new TrackingService({ eventPublisher });
    this.outbox = new OutboxService({ eventPublisher });
  }

  ensureDriver(context) {
    if (!context.user.driverId) throw new AppError('Driver profile is not linked', 403, 'DRIVER_PROFILE_MISSING');
    return context.user.driverId;
  }

  assignedFilter(context, extra = {}) { return { ...context.scope, driverId: this.ensureDriver(context), deletedAt: null, ...extra }; }
  profile(context) { return Driver.findOne({ _id: this.ensureDriver(context), ...context.scope, deletedAt: null }); }

  async trackerStatus(context, suppliedDriver) {
    const driverId = this.ensureDriver(context);
    const driver = suppliedDriver ?? await Driver.findOne({ _id: driverId, ...context.scope, deletedAt: null });
    const deviceFilter = driver?.gpsDeviceId
      ? { _id: driver.gpsDeviceId }
      : { assignedEntityId: driverId, deviceType: 'RIDER' };
    const device = await GPSDevice.findOne({ ...deviceFilter, ...context.scope, deletedAt: null }).lean();
    const staleAt = new Date(Date.now() - LIMITS.DRIVER_DARK_MINUTES * 60_000);
    const heartbeatCurrent = Boolean(device?.lastHeartbeatAt && device.lastHeartbeatAt >= staleAt);
    const active = Boolean(device && device.status === 'ACTIVE' && !device.tamperedAt && heartbeatCurrent);
    let warning = null;
    if (!device) warning = 'No rider GPS tracker is assigned';
    else if (device.tamperedAt) warning = 'Rider GPS tracker reports a tamper event';
    else if (device.status !== 'ACTIVE') warning = 'Rider GPS tracker is inactive';
    else if (!heartbeatCurrent) warning = `Rider GPS tracker has not reported within ${LIMITS.DRIVER_DARK_MINUTES} minutes`;
    return { active, warning, device };
  }

  updateProfile(input, context) {
    const allowed = Object.fromEntries(Object.entries(input).filter(([key]) => ['name', 'phone', 'email', 'stage', 'nextOfKin'].includes(key)));
    return Driver.findOneAndUpdate({ _id: this.ensureDriver(context), ...context.scope, deletedAt: null }, { $set: { ...allowed, updatedBy: context.user._id } }, { new: true, runValidators: true });
  }

  async updateStatus(status, context) {
    const driver = await Driver.findOneAndUpdate(
      { _id: this.ensureDriver(context), ...context.scope, deletedAt: null },
      { $set: { availability: status, updatedBy: context.user._id, lastHeartbeatAt: new Date() } },
      { new: true },
    );
    const tracker = await this.trackerStatus(context, driver);
    return { ...driver.toJSON(), tracker };
  }

  async dashboard(context) {
    const driverId = this.ensureDriver(context);
    const [driver, current, todayEarnings, fines] = await Promise.all([
      Driver.findOne({ _id: driverId, ...context.scope, deletedAt: null }),
      Order.findOne(this.assignedFilter(context, { orderStatus: { $nin: ['DELIVERED', 'RETURNED', 'CANCELLED'] } })).sort({ createdAt: -1 }),
      DriverEarning.aggregate([{ $match: { ...context.scope, driverId, deletedAt: null, businessDate: new Date().toISOString().slice(0, 10) } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      FinePenalty.aggregate([{ $match: { ...context.scope, driverId, deletedAt: null, status: 'ACTIVE' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);
    const tracker = await this.trackerStatus(context, driver);
    return { driver, currentOrder: current, earningsToday: todayEarnings[0]?.total ?? 0, fines: fines[0]?.total ?? 0, codWarning: driver.codHeld >= LIMITS.RIDER_COD_UGX * 0.8, codLimit: LIMITS.RIDER_COD_UGX, tracker };
  }

  async listOrders(query, context) {
    const { page, limit, skip } = parsePagination(query); const filter = this.assignedFilter(context);
    const status = query.orderStatus ?? query.status;
    if (status) filter.orderStatus = String(status).toUpperCase().replaceAll(' ', '_');
    const [items, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Order.countDocuments(filter)]);
    return { items, meta: paginationMeta(total, page, limit) };
  }

  async availableOrders(query, context) {
    const { page, limit, skip } = parsePagination(query); const filter = { ...context.scope, driverId: null, orderStatus: ORDER_STATUS.PENDING, hubScannedAt: { $ne: null }, deletedAt: null };
    const [items, total] = await Promise.all([Order.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit), Order.countDocuments(filter)]);
    return { items, meta: paginationMeta(total, page, limit) };
  }

  async getOrder(id, context) {
    const order = await Order.findOne({ _id: id, ...this.assignedFilter(context) })
      .populate('merchantId', 'businessName shopName phone address')
      .populate('packageId', 'packageTrackingId custodyStatus gpsDeviceId sealNumber tamperedAt')
      .lean();
    if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    const responseDeadline = order.assignedAt
      ? new Date(new Date(order.assignedAt).getTime() + 7 * 60_000)
      : null;
    return {
      ...order,
      responseDeadline,
      earningsPreview: Math.round((order.pricing?.total ?? 0) * 0.7),
      currency: order.pricing?.currency ?? 'UGX',
    };
  }
  accept(id, context) { return this.orders.transition(id, ORDER_STATUS.ACCEPTED, this.assignedFilter(context), context.actor, 'Driver accepted order'); }
  transition(id, status, note, context) { return this.orders.transition(id, status, this.assignedFilter(context), context.actor, note); }

  async reject(id, reason, context) {
    return withTransaction(async (session) => {
      const order = await Order.findOne({ _id: id, ...this.assignedFilter(context, { orderStatus: ORDER_STATUS.ASSIGNED }) }).session(session);
      if (!order) throw new AppError('Assigned order not found', 404, 'ORDER_NOT_FOUND');
      order.driverId = null; order.orderStatus = ORDER_STATUS.PENDING; order.updatedBy = context.user._id;
      order.timeline.push({ status: ORDER_STATUS.PENDING, note: reason, actorId: context.user._id, at: new Date() });
      await Promise.all([order.save({ session }), Driver.updateOne({ _id: context.user.driverId, ...context.scope }, { $set: { availability: 'AVAILABLE', updatedBy: context.user._id } }, { session })]);
      return order;
    });
  }

  async scanPackage(id, input, context) {
    return withTransaction(async (session) => {
      const order = await Order.findOne({ _id: id, ...this.assignedFilter(context) }).session(session); if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      const packageTrackingId = input.packageTrackingId.trim().toUpperCase();
      const trackerSerial = input.trackerSerial.trim().toUpperCase();
      const packageDocument = await Package.findOne({ _id: order.packageId, packageTrackingId, hubId: order.hubId, deletedAt: null }).session(session); if (!packageDocument) throw new AppError('Package does not match this order', 409, 'PACKAGE_MISMATCH');
      const device = await GPSDevice.findOne({ serialNumber: trackerSerial, hubId: order.hubId, deviceType: 'PACKAGE', deletedAt: null }).session(session); if (!device) throw new AppError('Package tracker not found', 404, 'TRACKER_NOT_FOUND');
      if (device.assignedEntityId && String(device.assignedEntityId) !== String(packageDocument._id)) throw new AppError('Package tracker is assigned to another package', 409, 'TRACKER_IN_USE');
      packageDocument.gpsDeviceId = device._id; packageDocument.custodyStatus = 'WITH_DRIVER'; packageDocument.updatedBy = context.user._id;
      device.assignedEntityId = packageDocument._id; device.updatedBy = context.user._id;
      const custody = await CustodyEvent.create([{ hubId: order.hubId, createdBy: context.user._id, updatedBy: context.user._id, status: 'ACTIVE', orderId: order._id, packageId: packageDocument._id, fromType: 'HUB', toType: 'DRIVER', toId: context.user.driverId, scanCode: packageTrackingId, occurredAt: new Date() }], { session }).then(([item]) => item);
      await Promise.all([packageDocument.save({ session }), device.save({ session })]);
      return { order, package: packageDocument, tracker: device, custody };
    });
  }

  async failDelivery(id, input, context) {
    const order = await this.orders.transition(id, ORDER_STATUS.FAILED, this.assignedFilter(context), context.actor, input.note);
    order.failureReason = input.reason;
    order.updatedBy = context.user._id;
    await order.save();
    await Promise.all([
      Driver.updateOne(
        { _id: this.ensureDriver(context), ...context.scope, deletedAt: null },
        { $inc: { failedDeliveries: 1 }, $set: { updatedBy: context.user._id } },
      ),
      Incident.create({
        hubId: order.hubId,
        driverId: this.ensureDriver(context),
        orderId: order._id,
        packageId: order.packageId,
        incidentNumber: `INC_${Date.now().toString(36).toUpperCase()}`,
        type: input.reason === 'PACKAGE_DAMAGED' ? 'PACKAGE_DAMAGE' : 'OTHER',
        description: `${input.reason}: ${input.note}`,
        location: input.location,
        photos: input.photos,
        status: 'OPEN',
        createdBy: context.user._id,
        updatedBy: context.user._id,
        reportedAt: new Date(),
      }),
    ]);
    await this.eventPublisher?.(SOCKET_EVENTS.INCIDENT_REPORTED, {
      hubId: order.hubId,
      orderId: order._id,
      driverId: context.user.driverId,
      reason: input.reason,
    });
    return order;
  }

  async requestDeliveryOtp(id, context) {
    const order = await Order.findOne({
      _id: id,
      ...this.assignedFilter(context, { orderStatus: ORDER_STATUS.OUT_FOR_DELIVERY }),
    });
    if (!order) throw new AppError('Active delivery not found', 404, 'ORDER_NOT_FOUND');
    const code = String(randomInt(1000, 10_000));
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    await OTP.updateMany(
      { hubId: order.hubId, entityId: order._id, purpose: 'DELIVERY', consumedAt: null, deletedAt: null },
      { $set: { consumedAt: new Date(), status: 'SUPERSEDED', updatedBy: context.user._id } },
    );
    const otp = await OTP.create({
      hubId: order.hubId,
      purpose: 'DELIVERY',
      recipient: order.customer.phone,
      codeHash: createHash('sha256').update(code).digest('hex'),
      entityId: order._id,
      expiresAt,
      status: 'ACTIVE',
      createdBy: context.user._id,
      updatedBy: context.user._id,
    });
    const notification = await Notification.create({
      hubId: order.hubId,
      recipientType: 'CUSTOMER',
      recipientId: order.customerId,
      orderId: order._id,
      title: 'Wolan delivery confirmation code',
      message: `Your Wolan delivery confirmation code is ${code}. It expires in 30 minutes.`,
      channels: ['SMS'],
      priority: 'HIGH',
      status: 'PENDING',
      metadata: { otpId: otp._id, expiresAt },
      createdBy: context.user._id,
      updatedBy: context.user._id,
    });
    await this.eventPublisher?.(SOCKET_EVENTS.NEW_NOTIFICATION, notification.toJSON());
    const recipient = order.customer.phone;
    return {
      otpId: otp._id,
      expiresAt,
      recipient: `${recipient.slice(0, 4)}${'*'.repeat(Math.max(0, recipient.length - 7))}${recipient.slice(-3)}`,
    };
  }

  async complete(id, input, context) {
    const result = await withTransaction(async (session) => {
      const order = await Order.findOne({ _id: id, ...this.assignedFilter(context, { orderStatus: ORDER_STATUS.OUT_FOR_DELIVERY }) }).session(session); if (!order) throw new AppError('Active delivery not found', 404, 'ORDER_NOT_FOUND');
      const otp = await OTP.findOne({ _id: input.otpId, hubId: order.hubId, entityId: order._id, purpose: 'DELIVERY', consumedAt: null, expiresAt: { $gt: new Date() }, deletedAt: null }).select('+codeHash').session(session); if (!otp) throw new AppError('OTP is invalid or expired', 422, 'INVALID_OTP');
      if (otp.attempts >= otp.maxAttempts) throw new AppError('OTP attempt limit exceeded', 429, 'OTP_ATTEMPTS_EXCEEDED');
      const expected = Buffer.from(otp.codeHash); const actual = Buffer.from(createHash('sha256').update(input.code).digest('hex'));
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) { otp.attempts += 1; await otp.save({ session }); throw new AppError('OTP is invalid', 422, 'INVALID_OTP'); }
      otp.consumedAt = new Date(); otp.status = 'CONSUMED'; await otp.save({ session });
      const proof = await DeliveryProof.create([{ hubId: order.hubId, createdBy: context.user._id, updatedBy: context.user._id, status: 'ACTIVE', orderId: order._id, driverId: context.user.driverId, photos: input.photos, otpId: otp._id, recipientName: input.recipientName, location: input.location, deliveredAt: new Date() }], { session }).then(([item]) => item);
      order.orderStatus = ORDER_STATUS.DELIVERED; order.deliveredAt = new Date(); order.updatedBy = context.user._id; order.timeline.push({ status: ORDER_STATUS.DELIVERED, note: 'OTP and proof of delivery verified', actorId: context.user._id, at: new Date() }); await order.save({ session });
      await Driver.updateOne({ _id: context.user.driverId, ...context.scope }, { $set: { availability: 'AVAILABLE', updatedBy: context.user._id }, $inc: { completedDeliveries: 1, codHeld: order.codAmount } }, { session });
      const packageDocument = await Package.findOne({ _id: order.packageId, hubId: order.hubId, deletedAt: null }).session(session);
      if (packageDocument) {
        packageDocument.custodyStatus = 'DELIVERED';
        packageDocument.updatedBy = context.user._id;
        await packageDocument.save({ session });
        if (packageDocument.gpsDeviceId) {
          await GPSDevice.updateOne(
            { _id: packageDocument.gpsDeviceId, hubId: order.hubId },
            { $unset: { assignedEntityId: 1 }, $set: { updatedBy: context.user._id, status: 'ACTIVE' } },
            { session },
          );
        }
      }
      if (order.codAmount > 0) { const serviceFee = Math.round(order.codAmount * LIMITS.COD_SERVICE_PERCENT / 100); await COD.create([{ hubId: order.hubId, orderId: order._id, driverId: context.user.driverId, merchantId: order.merchantId, amount: order.codAmount, serviceFee, merchantPayout: order.codAmount - serviceFee, businessDate: new Date().toISOString().slice(0, 10), collectedAt: new Date(), status: 'COLLECTED', createdBy: context.user._id, updatedBy: context.user._id }], { session }); }
      await DriverEarning.create([{ hubId: order.hubId, driverId: context.user.driverId, orderId: order._id, type: 'DELIVERY', amount: Math.round((order.pricing?.total ?? 0) * 0.7), businessDate: new Date().toISOString().slice(0, 10), status: 'EARNED', createdBy: context.user._id, updatedBy: context.user._id }], { session });
      await Notification.create([{
        hubId: order.hubId,
        recipientType: 'MERCHANT',
        recipientId: order.merchantId,
        orderId: order._id,
        title: 'Order delivered',
        message: `${order.orderNumber} was delivered with OTP and photo proof.`,
        channels: ['IN_APP'],
        priority: 'NORMAL',
        sentAt: new Date(),
        status: 'SENT',
        metadata: { proofId: proof._id, deliveredAt: order.deliveredAt },
        createdBy: context.user._id,
        updatedBy: context.user._id,
      }, {
        hubId: order.hubId,
        recipientType: 'CUSTOMER',
        recipientId: order.customerId,
        orderId: order._id,
        title: 'Wolan delivery receipt',
        message: `${order.orderNumber} was delivered successfully. Thank you for using Wolan Logistics.`,
        channels: ['SMS'],
        priority: 'NORMAL',
        status: 'PENDING',
        metadata: { proofId: proof._id, deliveredAt: order.deliveredAt },
        createdBy: context.user._id,
        updatedBy: context.user._id,
      }], { session });
      await AuditLog.create([{ hubId: order.hubId, actorId: context.user._id, actorRole: context.user.role, action: 'order.delivered', resourceType: 'Order', resourceId: order._id, requestId: context.requestId, after: { orderStatus: ORDER_STATUS.DELIVERED, proofId: proof._id }, status: 'RECORDED', createdBy: context.user._id, updatedBy: context.user._id }], { session });
      await OutboxEvent.create([{ hubId: order.hubId, eventId: randomUUID(), eventType: SOCKET_EVENTS.ORDER_DELIVERED, aggregateType: 'Order', aggregateId: order._id, payload: { hubId: order.hubId, orderId: order._id, driverId: context.user.driverId, merchantId: order.merchantId }, status: 'PENDING', createdBy: context.user._id, updatedBy: context.user._id }], { session });
      return { order, proof };
    });
    await this.outbox.drain({ limit: 100 });
    return result;
  }

  async updateLocation(input, context) {
    const driverId = this.ensureDriver(context);
    const driver = await Driver.findOne({ _id: driverId, ...context.scope, deletedAt: null });
    if (!driver) throw new AppError('Driver profile not found', 404, 'DRIVER_NOT_FOUND');
    const now = new Date();
    const updates = [Driver.updateOne(
      { _id: driverId, ...context.scope },
      { $set: { currentLocation: input.location, lastHeartbeatAt: now, updatedBy: context.user._id } },
    )];
    if (driver.gpsDeviceId) {
      updates.push(GPSDevice.updateOne(
        { _id: driver.gpsDeviceId, ...context.scope, deletedAt: null },
        { $set: { lastLocation: input.location, lastHeartbeatAt: now, battery: input.battery, signal: input.signal, updatedBy: context.user._id } },
      ));
    }
    await Promise.all(updates);
    const current = await Order.findOne(this.assignedFilter(context, { orderStatus: { $in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'AT_HUB', 'OUT_FOR_DELIVERY'] } }));
    return this.tracking.record({ ...input, entityType: 'DRIVER', entityId: driverId, orderId: current?._id, source: 'APP' }, context.actor);
  }

  async heartbeat(context) {
    const driverId = this.ensureDriver(context);
    const now = new Date();
    const driver = await Driver.findOneAndUpdate(
      { _id: driverId, ...context.scope, deletedAt: null },
      { $set: { lastHeartbeatAt: now, updatedBy: context.user._id } },
      { new: true },
    );
    if (driver?.gpsDeviceId) {
      await GPSDevice.updateOne(
        { _id: driver.gpsDeviceId, ...context.scope, deletedAt: null },
        { $set: { lastHeartbeatAt: now, updatedBy: context.user._id } },
      );
    }
    return { receivedAt: now, tracker: await this.trackerStatus(context, driver) };
  }

  async reportIncident(input, context) {
    const incident = await Incident.create({ ...input, hubId: context.actor.hubId, driverId: this.ensureDriver(context), incidentNumber: `INC_${Date.now().toString(36).toUpperCase()}`, status: 'OPEN', createdBy: context.user._id, updatedBy: context.user._id, reportedAt: new Date() });
    await this.eventPublisher?.(SOCKET_EVENTS.INCIDENT_REPORTED, {
      hubId: incident.hubId,
      incidentId: incident._id,
      driverId: incident.driverId,
      orderId: incident.orderId,
      type: incident.type,
    });
    return incident;
  }

  async earnings(context) {
    const driverId = this.ensureDriver(context);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const today = new Date().toISOString().slice(0, 10);
    const [earnings, fines, completedThisMonth] = await Promise.all([
      DriverEarning.find({ ...context.scope, driverId, deletedAt: null }).sort({ createdAt: -1 }).limit(100),
      FinePenalty.find({ ...context.scope, driverId, deletedAt: null }).sort({ createdAt: -1 }).limit(100),
      Order.countDocuments({ ...context.scope, driverId, orderStatus: ORDER_STATUS.DELIVERED, deliveredAt: { $gte: monthStart }, deletedAt: null }),
    ]);
    const earnedToday = earnings.filter((item) => item.businessDate === today).reduce((total, item) => total + item.amount, 0);
    const totalEarnings = earnings.reduce((total, item) => total + item.amount, 0);
    const totalFines = fines.reduce((total, item) => total + item.amount, 0);
    const bonusProgress = [20, 35].map((target) => ({
      target,
      completed: completedThisMonth,
      remaining: Math.max(0, target - completedThisMonth),
      achieved: completedThisMonth >= target,
    }));
    return { earnedToday, totalEarnings, totalFines, netEarnings: totalEarnings - totalFines, currency: 'UGX', completedThisMonth, bonusProgress, earnings, fines };
  }

  async codSummary(context) {
    const driverId = this.ensureDriver(context);
    const [driver, records] = await Promise.all([
      Driver.findOne({ _id: driverId, ...context.scope, deletedAt: null }).select('codHeld availability'),
      COD.find({ ...context.scope, driverId, deletedAt: null }).sort({ createdAt: -1 }).limit(100),
    ]);
    const held = driver?.codHeld ?? 0;
    return {
      held,
      limit: LIMITS.RIDER_COD_UGX,
      warningThreshold: Math.round(LIMITS.RIDER_COD_UGX * 0.8),
      warning: held >= LIMITS.RIDER_COD_UGX * 0.8,
      atLimit: held >= LIMITS.RIDER_COD_UGX,
      settlementRequired: held > 0,
      currency: 'UGX',
      records,
    };
  }

  notifications(context) { return Notification.find({ ...context.scope, recipientType: 'DRIVER', recipientId: this.ensureDriver(context), deletedAt: null }).sort({ createdAt: -1 }).limit(100); }
  markNotificationRead(id, context) { return Notification.findOneAndUpdate({ _id: id, ...context.scope, recipientType: 'DRIVER', recipientId: this.ensureDriver(context), deletedAt: null }, { $set: { readAt: new Date(), updatedBy: context.user._id } }, { new: true }); }
}
