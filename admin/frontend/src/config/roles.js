export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  HUB_MANAGER: 'HUB_MANAGER',
});

const ROLE_ALIASES = Object.freeze({ ADMIN: ROLES.SUPER_ADMIN });
export const normalizeRole = value => {
  const normalized = String(value || '').trim().replace(/[\s-]+/g, '_').toUpperCase();
  return ROLE_ALIASES[normalized] ?? normalized;
};
export const isHubManager = user => normalizeRole(user?.role) === ROLES.HUB_MANAGER;
export const isHqUser = user => [ROLES.SUPER_ADMIN, 'DIRECTOR'].includes(normalizeRole(user?.role));
export const dashboardPathFor = user => isHubManager(user) ? '/hub-dashboard' : '/';
