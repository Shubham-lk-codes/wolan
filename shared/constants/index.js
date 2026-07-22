export const DATABASE_NAME = 'wolan';
export const GLOBAL_HUB_ID = 'HUB_GLOBAL';
export const SYSTEM_ACTOR_ID = '000000000000000000000001';

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  DIRECTOR: 'DIRECTOR',
  REGIONAL_MANAGER: 'REGIONAL_MANAGER',
  HUB_MANAGER: 'HUB_MANAGER',
  OPS_COORDINATOR: 'OPS_COORDINATOR',
  MERCHANT: 'MERCHANT',
  DRIVER: 'DRIVER',
});
export const SYSTEM_ROLES = Object.freeze(Object.values(ROLES));
export const HQ_ROLES = Object.freeze([ROLES.SUPER_ADMIN, ROLES.DIRECTOR]);
export const HUB_ROLES = Object.freeze([ROLES.HUB_MANAGER, ROLES.OPS_COORDINATOR]);

const ROLE_ALIASES = Object.freeze({
  ADMIN: ROLES.SUPER_ADMIN,
});

export function normalizeRole(value) {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().replace(/[\s-]+/g, '_').toUpperCase();
  return ROLE_ALIASES[normalized] ?? normalized;
}

export const ORDER_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  PICKED_UP: 'PICKED_UP',
  AT_HUB: 'AT_HUB',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  RETURN_REQUESTED: 'RETURN_REQUESTED',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
});
export const ORDER_STATUSES = Object.freeze(Object.values(ORDER_STATUS));

export const DRIVER_STATUS = Object.freeze(['AVAILABLE', 'ON_DELIVERY', 'BREAK', 'OFFLINE']);
export const ACTIVE_STATUS = 'ACTIVE';
export const SOFT_DELETE_FILTER = Object.freeze({ deletedAt: null });

export const LIMITS = Object.freeze({
  COD_SERVICE_PERCENT: 10,
  RIDER_COD_UGX: 1_000_000,
  FIELD_COD_UGX: 5_000_000,
  INSURANCE_FEE_UGX: 2_000,
  INSURANCE_COVER_LIMIT_UGX: 500_000,
  INSURANCE_PAYOUT_PERCENT: 50,
  TRACKER_MISMATCH_METRES: 500,
  DRIVER_DARK_MINUTES: 15,
  IDLE_DRIVER_MINUTES: 10,
});
