import { HQ_ROLES, ROLES } from '../constants/index.js';
import { AppError } from '../utils/index.js';

const full = ['*'];
export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.SUPER_ADMIN]: full,
  [ROLES.DIRECTOR]: full,
  [ROLES.REGIONAL_MANAGER]: ['dashboard:*', 'hub:read', 'order:*', 'merchant:*', 'driver:*', 'package:*', 'tracking:*', 'cod:*', 'payment:*', 'incident:*', 'report:*', 'notification:*', 'upload:*', 'audit:read'],
  [ROLES.HUB_MANAGER]: ['dashboard:read', 'order:*', 'merchant:*', 'driver:*', 'package:*', 'tracking:*', 'cod:*', 'payment:read', 'incident:*', 'report:*', 'notification:*', 'upload:*', 'setting:read'],
  [ROLES.OPS_COORDINATOR]: ['dashboard:read', 'order:*', 'merchant:read', 'driver:read', 'driver:update', 'package:*', 'tracking:*', 'cod:read', 'incident:*', 'notification:*', 'upload:*'],
  [ROLES.MERCHANT]: ['merchant:self', 'order:create', 'order:read-own', 'order:update-own', 'tracking:read-own', 'payment:read-own', 'notification:read-own', 'referral:read-own'],
  [ROLES.DRIVER]: ['driver:self', 'order:read-assigned', 'order:update-assigned', 'tracking:create', 'tracking:read-assigned', 'otp:verify', 'incident:create', 'earning:read-own', 'notification:read-own'],
});

export function hasPermission(user, permission) {
  const grants = new Set([...(ROLE_PERMISSIONS[user?.role] ?? []), ...(user?.permissions ?? [])]);
  if (grants.has('*') || grants.has(permission)) return true;
  const [resource] = permission.split(':');
  return grants.has(`${resource}:*`);
}

export function resolveHubScope(user, requestedHubId) {
  if (!user) throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
  if (HQ_ROLES.includes(user.role)) return requestedHubId ? Object.freeze({ hubId: requestedHubId }) : Object.freeze({});
  const allowed = user.role === ROLES.REGIONAL_MANAGER ? [...new Set(user.assignedHubIds ?? [])] : [user.hubId];
  if (!allowed.length || allowed.some((hubId) => !hubId)) throw new AppError('No hub access assigned', 403, 'HUB_ACCESS_MISSING');
  if (requestedHubId && !allowed.includes(requestedHubId)) throw new AppError('Hub access denied', 403, 'HUB_ACCESS_DENIED');
  return Object.freeze({ hubId: requestedHubId ?? (allowed.length === 1 ? allowed[0] : { $in: allowed }) });
}
