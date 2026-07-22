import { COD, Driver, Hub, Merchant, Order, Setting } from '@wolan/shared/models';
import { AppError } from '@wolan/shared/utils';

export const HUB_MANAGER_SETTING_KEYS = Object.freeze({
  dispatch: 'hub_manager.dispatch',
  notifications: 'hub_manager.notifications',
  workingHours: 'hub_manager.working_hours',
});

const settingDefaults = Object.freeze({
  dispatch: Object.freeze({
    maxOrdersPerDriver: 8,
    defaultDeliveryEtaMinutes: 45,
    assignmentRadiusKm: 3,
    idleAlertMinutes: 15,
    gpsDarkAlertMinutes: 10,
    codRemitDeadlineHours: 24,
    autoAssignNearestDriver: true,
    prioritizeEliteMerchants: true,
    blockOfflineDrivers: true,
    allowDriverSelfAssignment: false,
  }),
  notifications: Object.freeze({
    newOrder: true,
    driverOffline: true,
    failedDelivery: true,
    codAlert: true,
    delayAlert: true,
  }),
  workingHours: Object.freeze({
    mondayFriday: '07:00 - 21:00',
    saturday: '07:00 - 21:00',
    sunday: 'Closed',
  }),
});

function requireHubId(scope) {
  if (!scope?.hubId || typeof scope.hubId !== 'string') {
    throw new AppError('A single assigned hub is required', 403, 'HUB_ACCESS_MISSING');
  }
  return scope.hubId;
}

function kampalaDayRange(now = new Date()) {
  const offsetMs = 3 * 60 * 60_000;
  const local = new Date(now.getTime() + offsetMs);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offsetMs);
  return { start, end: now };
}

const statusCount = (rows, status) => rows.find((row) => row._id === status)?.count ?? 0;

export class HubManagerService {
  async dashboard(scope, now = new Date()) {
    const hubId = requireHubId(scope);
    const tenant = { hubId, deletedAt: null };
    const today = kampalaDayRange(now);
    const todayFilter = { ...tenant, createdAt: { $gte: today.start, $lte: today.end } };
    const weekStart = new Date(today.start.getTime() - 6 * 24 * 60 * 60_000);

    const [
      hub,
      todayStatuses,
      onlineDrivers,
      totalDrivers,
      totalMerchants,
      codRows,
      timingRows,
      recentOrders,
      liveRiders,
      hourlyRows,
      weeklyRows,
      zoneRows,
    ] = await Promise.all([
      Hub.findOne(tenant).select('hubId code name address city region zoneCoverage phone email dailyTarget status managerId').lean(),
      Order.aggregate([
        { $match: todayFilter },
        { $group: { _id: '$orderStatus', count: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'DELIVERED'] }, { $ifNull: ['$pricing.total', 0] }, 0] } } } },
      ]),
      Driver.countDocuments({ ...tenant, status: 'ACTIVE', availability: { $ne: 'OFFLINE' } }),
      Driver.countDocuments(tenant),
      Merchant.countDocuments(tenant),
      COD.aggregate([
        { $match: { ...tenant, status: { $in: ['PENDING', 'COLLECTED'] } } },
        { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { ...todayFilter, orderStatus: { $in: ['DELIVERED', 'FAILED'] } } },
        { $group: {
          _id: null,
          pickupToDelivery: { $avg: { $cond: [{ $and: ['$pickedUpAt', '$deliveredAt'] }, { $divide: [{ $subtract: ['$deliveredAt', '$pickedUpAt'] }, 60_000] }, null] } },
          placementToDelivery: { $avg: { $cond: [{ $and: ['$createdAt', '$deliveredAt'] }, { $divide: [{ $subtract: ['$deliveredAt', '$createdAt'] }, 60_000] }, null] } },
          driverResponse: { $avg: { $cond: [{ $and: ['$assignedAt', '$acceptedAt'] }, { $divide: [{ $subtract: ['$acceptedAt', '$assignedAt'] }, 60_000] }, null] } },
        } },
      ]),
      Order.find(todayFilter)
        .select('orderNumber merchantId driverId customer delivery orderStatus pricing paymentMethod codAmount createdAt')
        .populate('merchantId', 'businessName shopName')
        .populate('driverId', 'name')
        .sort({ createdAt: -1 }).limit(10).lean(),
      Driver.find({ ...tenant, status: 'ACTIVE', availability: { $ne: 'OFFLINE' } })
        .select('name availability completedDeliveries currentLocation vehicleId lastHeartbeatAt')
        .sort({ lastHeartbeatAt: -1 }).limit(20).lean(),
      Order.aggregate([
        { $match: todayFilter },
        { $group: { _id: { $dateToString: { format: '%H:00', date: '$createdAt', timezone: 'Africa/Kampala' } }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { ...tenant, createdAt: { $gte: weekStart, $lte: today.end } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Africa/Kampala' } },
          completed: { $sum: { $cond: [{ $eq: ['$orderStatus', 'DELIVERED'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$orderStatus', 'FAILED'] }, 1, 0] } },
        } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: todayFilter },
        { $group: { _id: { $ifNull: ['$delivery.zoneId', 'Unzoned'] }, orders: { $sum: 1 } } },
        { $sort: { orders: -1 } },
        { $limit: 10 },
      ]),
    ]);

    if (!hub) throw new AppError('Assigned hub not found', 404, 'HUB_NOT_FOUND');

    const todayOrders = todayStatuses.reduce((sum, row) => sum + row.count, 0);
    const deliveredOrders = statusCount(todayStatuses, 'DELIVERED');
    const failedOrders = statusCount(todayStatuses, 'FAILED');
    const pendingOrders = ['PENDING', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'AT_HUB', 'OUT_FOR_DELIVERY']
      .reduce((sum, status) => sum + statusCount(todayStatuses, status), 0);
    const timing = timingRows[0] ?? {};
    const codInField = codRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const revenue = todayStatuses.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
    const dailyTarget = Number(hub.dailyTarget || 0);

    return {
      scope: { hubId, hubName: hub.name, hubCode: hub.code },
      generatedAt: now,
      metrics: {
        todayOrders,
        pendingOrders,
        deliveredOrders,
        failedOrders,
        onlineDrivers,
        totalDrivers,
        totalMerchants,
        todayRevenue: revenue,
        codInField,
        codOrders: codRows.reduce((sum, row) => sum + row.count, 0),
        dailyTarget,
        targetHitRate: dailyTarget ? Number((deliveredOrders / dailyTarget * 100).toFixed(1)) : 0,
      },
      statusMix: Object.fromEntries(todayStatuses.map((row) => [row._id, row.count])),
      packageStaging: {
        pending: statusCount(todayStatuses, 'PENDING'),
        pickedUp: statusCount(todayStatuses, 'PICKED_UP'),
        atHub: statusCount(todayStatuses, 'AT_HUB'),
        outForDelivery: statusCount(todayStatuses, 'OUT_FOR_DELIVERY'),
      },
      performance: {
        avgPickupToDeliveryMinutes: Math.round(timing.pickupToDelivery || 0),
        avgPlacementToDeliveryMinutes: Math.round(timing.placementToDelivery || 0),
        avgDriverResponseMinutes: Math.round(timing.driverResponse || 0),
        failedDeliveryRate: todayOrders ? Number((failedOrders / todayOrders * 100).toFixed(1)) : 0,
        weeklyCompleted: weeklyRows.reduce((sum, row) => sum + row.completed, 0),
        weeklyFailed: weeklyRows.reduce((sum, row) => sum + row.failed, 0),
      },
      cod: { amount: codInField, count: codRows.reduce((sum, row) => sum + row.count, 0), byStatus: codRows },
      recentOrders,
      liveRiders,
      deliveryTrend: hourlyRows.map((row) => ({ label: row._id, orders: row.orders })),
      weeklyDeliveries: weeklyRows.map((row) => ({ date: row._id, completed: row.completed, failed: row.failed })),
      zoneDistribution: zoneRows.map((row) => ({ zoneId: String(row._id), orders: row.orders })),
    };
  }

  async context(scope) {
    const hubId = requireHubId(scope);
    const tenant = { hubId, deletedAt: null };
    const [hub, orderRows, drivers, merchants] = await Promise.all([
      Hub.findOne(tenant).select('hubId code name address city region zoneCoverage phone email dailyTarget status managerId').lean(),
      Order.aggregate([{ $match: tenant }, { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'DELIVERED'] }, { $ifNull: ['$pricing.total', 0] }, 0] } } } }]),
      Driver.countDocuments(tenant),
      Merchant.countDocuments(tenant),
    ]);
    if (!hub) throw new AppError('Assigned hub not found', 404, 'HUB_NOT_FOUND');
    return { hub, metrics: { orders: orderRows[0]?.orders ?? 0, revenue: orderRows[0]?.revenue ?? 0, drivers, merchants, active: hub.status === 'ACTIVE' } };
  }

  async settings(scope) {
    const hubId = requireHubId(scope);
    const rows = await Setting.find({
      hubId,
      key: { $in: Object.values(HUB_MANAGER_SETTING_KEYS) },
      deletedAt: null,
    }).select('key value updatedAt').lean();
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return Object.fromEntries(Object.entries(HUB_MANAGER_SETTING_KEYS).map(([section, key]) => [
      section,
      { ...settingDefaults[section], ...(values[key] ?? {}) },
    ]));
  }

  async updateSettings(input, actor) {
    const hubId = actor?.hubId;
    if (!hubId || typeof hubId !== 'string') throw new AppError('A single assigned hub is required', 403, 'HUB_ACCESS_MISSING');
    const current = await this.settings({ hubId });
    const entries = Object.entries(input);
    await Setting.bulkWrite(entries.map(([section, changes]) => {
      const key = HUB_MANAGER_SETTING_KEYS[section];
      return {
        updateOne: {
          filter: { hubId, key, deletedAt: null },
          update: {
            $setOnInsert: { hubId, key, createdBy: actor.actorId },
            $set: { value: { ...current[section], ...changes }, status: 'ACTIVE', updatedBy: actor.actorId },
          },
          upsert: true,
        },
      };
    }));
    return this.settings({ hubId });
  }
}

export const hubManagerService = new HubManagerService();
