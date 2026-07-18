export const SOCKET_EVENTS = Object.freeze({
  ORDER_CREATED: 'orderCreated',
  ORDER_ASSIGNED: 'orderAssigned',
  ORDER_ACCEPTED: 'orderAccepted',
  ORDER_STATUS_CHANGED: 'orderStatusChanged',
  DRIVER_LOCATION: 'driverLocation',
  PACKAGE_LOCATION: 'packageLocation',
  DRIVER_OFFLINE: 'driverOffline',
  PACKAGE_MISMATCH: 'packageMismatch',
  NEW_NOTIFICATION: 'newNotification',
  ORDER_DELIVERED: 'orderDelivered',
  OTP_VERIFIED: 'OTPVerified',
  TRACKER_TAMPERED: 'trackerTampered',
  INCIDENT_REPORTED: 'incidentReported',
  COD_LIMIT_WARNING: 'codLimitWarning',
  DASHBOARD_UPDATED: 'dashboardUpdated',
});

export const socketRooms = Object.freeze({
  hq: () => 'hq',
  hub: (hubId) => `hub:${hubId}`,
  user: (id) => `user:${id}`,
  role: (role) => `role:${role}`,
  merchant: (id) => `merchant:${id}`,
  driver: (id) => `driver:${id}`,
  order: (id) => `order:${id}`,
  tracking: (token) => `tracking:${token}`,
});
