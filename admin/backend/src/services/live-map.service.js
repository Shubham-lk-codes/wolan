import { Driver, Hub, Order, SecurityAlert, Tracking, Zone } from '@wolan/shared/models';
import { HQ_ROLES } from '@wolan/shared/constants';
import {
  ACTIVE_DELIVERY_STATUSES,
  deliveryTiming,
  locationDto,
  mismatchState,
  stationaryState,
} from '../utils/live-map.utils.js';

const idOf = (value) => String(value?._id ?? value ?? '');

function currentOrdersByDriver(orders) {
  const result = new Map();
  for (const order of orders) {
    const driverId = idOf(order.driverId);
    if (driverId && !result.has(driverId)) result.set(driverId, order);
  }
  return result;
}

function orderDto(order, riderLocation, packageSample, now) {
  if (!order) return null;
  const packageLocation = locationDto(packageSample?.location, packageSample?.recordedAt, packageSample);
  const timing = deliveryTiming(order, riderLocation, now, riderLocation?.speed);
  const mismatch = mismatchState(riderLocation, packageLocation);
  return {
    id: idOf(order),
    orderNumber: order.orderNumber,
    status: order.orderStatus,
    customer: order.customer?.name ?? 'Customer',
    destination: order.delivery?.address ?? 'Destination unavailable',
    destinationLocation: locationDto(order.delivery?.location),
    scheduledAt: order.delivery?.scheduledAt ?? null,
    packageId: idOf(order.packageId),
    packageTrackingId: order.packageTrackingId,
    riderLocation,
    packageLocation,
    ...timing,
    ...mismatch,
  };
}

function summaryForHub(drivers, pendingOrders, hubId) {
  const scoped = hubId ? drivers.filter((driver) => driver.hubId === hubId) : drivers;
  return {
    onlineDrivers: scoped.filter((driver) => driver.availability !== 'OFFLINE').length,
    activeDeliveries: scoped.filter((driver) => Boolean(driver.currentOrder)).length,
    delayedRiders: scoped.filter((driver) => driver.delayed).length,
    pendingOrders: hubId ? pendingOrders.get(hubId) ?? 0 : [...pendingOrders.values()].reduce((sum, count) => sum + count, 0),
  };
}

export class LiveMapService {
  async snapshot(scope, actor) {
    const filter = { ...scope, deletedAt: null };
    const [driverRows, orderRows, zones, hubs, pendingRows] = await Promise.all([
      Driver.find({ ...filter, status: 'ACTIVE' })
        .select('hubId driverCode name phone plateNumber availability currentLocation lastHeartbeatAt rating zones vehicleId')
        .sort({ lastHeartbeatAt: -1 })
        .lean(),
      Order.find({ ...filter, driverId: { $ne: null }, orderStatus: { $in: ACTIVE_DELIVERY_STATUSES } })
        .select('hubId orderNumber driverId packageId packageTrackingId customer delivery orderStatus assignedAt acceptedAt pickedUpAt atHubAt outForDeliveryAt createdAt')
        .sort({ outForDeliveryAt: -1, createdAt: -1 })
        .lean(),
      Zone.find({ ...filter, status: 'ACTIVE' }).select('hubId code name boundary deliveryFee').sort({ name: 1 }).lean(),
      Hub.find({ ...filter, status: 'ACTIVE' }).select('hubId code name city region location zoneCoverage').sort({ name: 1 }).lean(),
      Order.aggregate([
        { $match: { ...filter, orderStatus: 'PENDING' } },
        { $group: { _id: '$hubId', count: { $sum: 1 } } },
      ]),
    ]);

    const driverIds = driverRows.map((driver) => driver._id);
    const orderIds = orderRows.map((order) => order._id);
    const trackingWindowStart = new Date(Date.now() - 6 * 60 * 60_000);
    const [driverTrackingGroups, packageTrackingGroups, mismatchAlerts] = await Promise.all([
      driverIds.length ? Tracking.aggregate([
        { $match: { ...filter, entityType: 'DRIVER', entityId: { $in: driverIds }, recordedAt: { $gte: trackingWindowStart } } },
        { $sort: { recordedAt: -1 } },
        { $group: { _id: '$entityId', samples: { $push: '$$ROOT' } } },
        { $project: { samples: { $slice: ['$samples', 120] } } },
      ]).allowDiskUse(true) : [],
      orderIds.length ? Tracking.aggregate([
        { $match: { ...filter, entityType: 'PACKAGE', orderId: { $in: orderIds } } },
        { $sort: { recordedAt: -1 } },
        { $group: { _id: '$orderId', sample: { $first: '$$ROOT' } } },
      ]).allowDiskUse(true) : [],
      orderIds.length ? SecurityAlert.find({ ...filter, type: 'PACKAGE_MISMATCH', status: 'OPEN', orderId: { $in: orderIds } })
        .select('orderId severity details createdAt').sort({ createdAt: -1 }).lean() : [],
    ]);

    const driverTracking = new Map(driverTrackingGroups.map((row) => [idOf(row._id), row.samples]));
    const packageTrackingByOrder = new Map(packageTrackingGroups.map((row) => [idOf(row._id), row.sample]));
    const alertsByOrder = new Map(mismatchAlerts.map((alert) => [idOf(alert.orderId), alert]));
    const ordersByDriver = currentOrdersByDriver(orderRows);
    const hubNames = new Map(hubs.map((hub) => [hub.hubId, hub.name]));
    const now = new Date();

    const drivers = driverRows.map((driver) => {
      const driverId = idOf(driver);
      const samples = driverTracking.get(driverId) ?? [];
      const latestSample = samples[0];
      const riderLocation = locationDto(latestSample?.location ?? driver.currentLocation, latestSample?.recordedAt ?? driver.lastHeartbeatAt, latestSample);
      const stationary = stationaryState(samples, now);
      const order = ordersByDriver.get(driverId);
      const currentOrder = orderDto(order, riderLocation, order ? packageTrackingByOrder.get(idOf(order)) : null, now);
      const alert = currentOrder ? alertsByOrder.get(currentOrder.id) : null;
      const delayed = Boolean(currentOrder?.delayed);
      return {
        id: driverId,
        hubId: driver.hubId,
        hubName: hubNames.get(driver.hubId) ?? driver.hubId,
        driverCode: driver.driverCode,
        name: driver.name,
        phone: driver.phone,
        plateNumber: driver.plateNumber ?? 'Not assigned',
        availability: driver.availability,
        displayStatus: delayed ? 'DELAYED' : driver.availability,
        rating: driver.rating,
        zones: driver.zones,
        location: riderLocation,
        lastHeartbeatAt: latestSample?.recordedAt ?? driver.lastHeartbeatAt ?? null,
        idle: driver.availability !== 'OFFLINE' && stationary.idle,
        stationarySince: stationary.stationarySince,
        stationaryMinutes: stationary.stationaryMinutes,
        delayed,
        currentOrder: currentOrder ? {
          ...currentOrder,
          mismatch: currentOrder.mismatch || Boolean(alert),
          mismatchAlert: alert ? { id: idOf(alert), severity: alert.severity, createdAt: alert.createdAt, details: alert.details } : null,
        } : null,
      };
    });

    const pendingOrders = new Map(pendingRows.map((row) => [row._id, row.count]));
    const statsByHub = Object.fromEntries(hubs.map((hub) => [hub.hubId, summaryForHub(drivers, pendingOrders, hub.hubId)]));
    return {
      generatedAt: now,
      access: {
        mode: HQ_ROLES.includes(actor.role) ? 'HQ' : 'HUB',
        role: actor.role,
        hubId: actor.hubId ?? null,
      },
      stats: summaryForHub(drivers, pendingOrders),
      statsByHub,
      drivers,
      hubs: hubs.map((hub) => ({
        id: hub.hubId,
        name: hub.name,
        code: hub.code,
        city: hub.city,
        region: hub.region,
        location: locationDto(hub.location),
      })),
      zones: zones.map((zone) => ({
        id: idOf(zone),
        hubId: zone.hubId,
        code: zone.code,
        name: zone.name,
        boundary: zone.boundary,
        deliveryFee: zone.deliveryFee,
      })),
    };
  }
}
