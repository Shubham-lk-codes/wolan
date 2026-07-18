import {
  COD,
  DeliveryProof,
  Merchant,
  Notification,
  Order,
  Package,
  Payment,
  Payout,
  Referral,
  Tracking,
} from '../models/index.js';
import { ORDER_STATUS } from '../constants/index.js';
import { AppError, paginationMeta, parsePagination } from '../utils/index.js';
import { OrderService } from './index.js';

export class MerchantPortalService {
  constructor({ eventPublisher } = {}) { this.orders = new OrderService({ eventPublisher }); }

  filter(context, extra = {}) {
    if (!context.user.merchantId) throw new AppError('Merchant profile is not linked', 403, 'MERCHANT_PROFILE_MISSING');
    return { ...context.scope, merchantId: context.user.merchantId, deletedAt: null, ...extra };
  }

  profile(context) { return Merchant.findOne({ _id: context.user.merchantId, ...context.scope, deletedAt: null }); }

  updateProfile(input, context) {
    const allowed = Object.fromEntries(Object.entries(input).filter(([key]) => ['businessName', 'shopName', 'building', 'phone', 'email', 'ownerName', 'address'].includes(key)));
    return Merchant.findOneAndUpdate({ _id: context.user.merchantId, ...context.scope, deletedAt: null }, { $set: { ...allowed, updatedBy: context.user._id } }, { new: true, runValidators: true });
  }

  async dashboard(context) {
    const filter = this.filter(context);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [byStatus, codDue, referral, merchant, totalDeliveriesThisMonth, totalOrdersThisMonth] = await Promise.all([
      Order.aggregate([{ $match: filter }, { $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
      COD.aggregate([{ $match: { ...filter, status: { $in: ['PENDING', 'COLLECTED'] } } }, { $group: { _id: null, total: { $sum: '$merchantPayout' } } }]),
      Referral.aggregate([{ $match: { ...context.scope, referrerMerchantId: context.user.merchantId, deletedAt: null } }, { $group: { _id: null, shops: { $sum: 1 }, earnings: { $sum: '$earnings' } } }]),
      Merchant.findOne({ _id: context.user.merchantId, ...context.scope, deletedAt: null }).select('tier referralCode referralEarnings'),
      Order.countDocuments({ ...filter, orderStatus: ORDER_STATUS.DELIVERED, deliveredAt: { $gte: monthStart } }),
      Order.countDocuments({ ...filter, createdAt: { $gte: monthStart } }),
    ]);
    return {
      orders: Object.fromEntries(byStatus.map((item) => [item._id, item.count])),
      totalDeliveriesThisMonth,
      totalOrdersThisMonth,
      codDue: codDue[0]?.total ?? 0,
      referral: referral[0] ?? { shops: 0, earnings: 0 },
      tier: merchant?.tier,
      referralCode: merchant?.referralCode,
      referralEarnings: merchant?.referralEarnings ?? referral[0]?.earnings ?? 0,
    };
  }

  createOrder(input, context) { return this.orders.create({ ...input, merchantId: context.user.merchantId }, context.actor); }

  async listOrders(query, context) {
    const { page, limit, skip } = parsePagination(query); const filter = this.filter(context);
    const status = query.orderStatus ?? query.status;
    if (status) filter.orderStatus = String(status).toUpperCase().replaceAll(' ', '_');
    const [items, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Order.countDocuments(filter)]);
    return { items, meta: paginationMeta(total, page, limit) };
  }

  async getOrder(id, context) {
    const order = await Order.findOne({ _id: id, ...this.filter(context) });
    if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    return order;
  }

  sendOff(id, context) { return this.orders.markMerchantSendOff(id, this.filter(context), context.actor); }
  cancel(id, reason, context) { return this.orders.transition(id, ORDER_STATUS.CANCELLED, this.filter(context), context.actor, reason); }

  async finance(context) {
    const filter = this.filter(context);
    const [cod, payments, payouts, referrals] = await Promise.all([
      COD.find(filter).sort({ createdAt: -1 }).limit(100),
      Payment.find(filter).sort({ createdAt: -1 }).limit(100),
      Payout.find(filter).sort({ createdAt: -1 }).limit(100),
      Referral.find({ ...context.scope, referrerMerchantId: context.user.merchantId, deletedAt: null }).sort({ createdAt: -1 }).limit(100),
    ]);
    return { cod, payments, payouts, referrals };
  }

  async cod(context) {
    const filter = this.filter(context);
    const [records, outstanding] = await Promise.all([
      COD.find(filter).sort({ createdAt: -1 }).limit(100),
      COD.aggregate([
        { $match: { ...filter, status: { $in: ['PENDING', 'COLLECTED'] } } },
        { $group: { _id: null, amount: { $sum: '$amount' }, serviceFees: { $sum: '$serviceFee' }, merchantPayout: { $sum: '$merchantPayout' } } },
      ]),
    ]);
    return {
      amountDue: outstanding[0]?.merchantPayout ?? 0,
      grossOutstanding: outstanding[0]?.amount ?? 0,
      serviceFees: outstanding[0]?.serviceFees ?? 0,
      currency: 'UGX',
      records,
    };
  }

  payments(context) {
    return Payment.find(this.filter(context)).sort({ createdAt: -1 }).limit(100);
  }

  payouts(context) {
    return Payout.find(this.filter(context)).sort({ createdAt: -1 }).limit(100);
  }

  async referrals(context) {
    const filter = { ...context.scope, referrerMerchantId: context.user.merchantId, deletedAt: null };
    const [merchant, records, summary] = await Promise.all([
      Merchant.findOne({ _id: context.user.merchantId, ...context.scope, deletedAt: null }).select('tier referralCode referralEarnings'),
      Referral.find(filter).sort({ createdAt: -1 }).limit(100),
      Referral.aggregate([{ $match: filter }, { $group: { _id: null, shops: { $sum: 1 }, qualifiedDeliveries: { $sum: '$qualifiedDeliveries' }, earnings: { $sum: '$earnings' } } }]),
    ]);
    return {
      referralCode: merchant?.referralCode,
      tier: merchant?.tier,
      referredShops: summary[0]?.shops ?? 0,
      qualifiedDeliveries: summary[0]?.qualifiedDeliveries ?? 0,
      earnings: merchant?.referralEarnings ?? summary[0]?.earnings ?? 0,
      currency: 'UGX',
      records,
    };
  }

  notifications(context) { return Notification.find({ ...context.scope, recipientType: 'MERCHANT', recipientId: context.user.merchantId, deletedAt: null }).sort({ createdAt: -1 }).limit(100); }
  markNotificationRead(id, context) { return Notification.findOneAndUpdate({ _id: id, ...context.scope, recipientType: 'MERCHANT', recipientId: context.user.merchantId, deletedAt: null }, { $set: { readAt: new Date(), updatedBy: context.user._id } }, { new: true }); }

  async tracking(id, context) {
    const order = await Order.findOne({ _id: id, ...this.filter(context) })
      .select('orderNumber orderStatus driverId packageId riderTrackingId packageTrackingId timeline assignedAt acceptedAt pickedUpAt atHubAt outForDeliveryAt deliveredAt failedAt returnedAt cancelledAt')
      .populate('driverId', 'name phone driverCode rating currentLocation lastHeartbeatAt')
      .lean();
    if (!order) throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    const [samples, packageDocument, deliveryProof] = await Promise.all([
      Tracking.aggregate([{ $match: { ...context.scope, orderId: order._id, deletedAt: null } }, { $sort: { recordedAt: -1 } }, { $group: { _id: '$entityType', sample: { $first: '$$ROOT' } } }]),
      Package.findOne({ _id: order.packageId, ...context.scope, deletedAt: null })
        .select('packageTrackingId custodyStatus gpsDeviceId tamperedAt')
        .populate('gpsDeviceId', 'serialNumber lastLocation lastHeartbeatAt battery signal tamperedAt status')
        .lean(),
      DeliveryProof.findOne({ orderId: order._id, ...context.scope, deletedAt: null })
        .select('driverId recipientName photos location deliveredAt otpId')
        .lean(),
    ]);
    return {
      order,
      rider: order.driverId ?? null,
      package: packageDocument,
      deliveryProof,
      locations: Object.fromEntries(samples.map((item) => [item._id.toLowerCase(), item.sample])),
    };
  }
}
