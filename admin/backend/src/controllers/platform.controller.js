import { AdminPortalService, AuthService, NotificationService, OrderService, PublicPortalService, TrackingService, UploadService } from '@wolan/shared/services';
import { AppError, successResponse } from '@wolan/shared/utils';
import { env } from '../config/env.js';
import { HQ_ROLES, ROLES } from '@wolan/shared/constants';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { cloudinaryUploadProvider } from '../services/upload-provider.js';

const auth = new AuthService({ accessSecret: env.jwtAccessSecret, refreshSecret: env.jwtRefreshSecret, accessExpiresIn: env.jwtAccessExpiresIn, refreshExpiresIn: env.jwtRefreshExpiresIn, issuer: env.jwtIssuer, audience: env.jwtAudience });
const publish = async (event, payload) => globalThis.wolanEventPublisher?.(event, payload);
const orders = new OrderService({ eventPublisher: publish });
const tracking = new TrackingService({ eventPublisher: publish });
const notifications = new NotificationService({ eventPublisher: publish });
const admin = new AdminPortalService();
const publicPortal = new PublicPortalService();
const uploads = new UploadService(cloudinaryUploadProvider);

const adminRoles = new Set([...HQ_ROLES, ROLES.REGIONAL_MANAGER, ROLES.HUB_MANAGER, ROLES.OPS_COORDINATOR]);
const requireAdminSession = async (result) => {
  if (adminRoles.has(result.user.role)) return result;
  await auth.logout(result.refreshToken);
  throw new AppError('Admin account required', 403, 'ADMIN_ACCOUNT_REQUIRED');
};

const refreshCookieName = 'wolan_refresh';
const csrfCookieName = 'wolan_csrf';
const parseCookies = (request) => Object.fromEntries((request.get('cookie') ?? '').split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key]) => key));
const cookie = (name, value, { httpOnly = false, maxAge = 30 * 24 * 60 * 60 } = {}) => `${name}=${encodeURIComponent(value)}; Path=/api/v1/admin/auth; Max-Age=${maxAge}; SameSite=Strict${httpOnly ? '; HttpOnly' : ''}${env.isProduction ? '; Secure' : ''}`;
const clearCookie = (name, httpOnly = false) => cookie(name, '', { httpOnly, maxAge: 0 });
const setAdminSession = (response, result) => {
  const csrfToken = randomBytes(24).toString('base64url');
  response.append('set-cookie', cookie(refreshCookieName, result.refreshToken, { httpOnly: true }));
  response.append('set-cookie', cookie(csrfCookieName, csrfToken));
  return { accessToken: result.accessToken, user: result.user, csrfToken };
};
const refreshCredentials = (request) => {
  const cookies = parseCookies(request);
  const supplied = Buffer.from(request.get('x-csrf-token') ?? '');
  const expected = Buffer.from(cookies[csrfCookieName] ?? '');
  if (!cookies[refreshCookieName] || !supplied.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new AppError('CSRF validation failed', 403, 'CSRF_VALIDATION_FAILED');
  return { refreshToken: cookies[refreshCookieName], cookies };
};

export const login = async (request, response) => { const result = await requireAdminSession(await auth.login(request.body, { ip: request.ip, userAgent: request.get('user-agent') })); return successResponse(response, setAdminSession(response, result), { message: 'Login successful' }); };
export const refresh = async (request, response) => { const { refreshToken } = refreshCredentials(request); const result = await requireAdminSession(await auth.refresh(refreshToken, { ip: request.ip, userAgent: request.get('user-agent') })); return successResponse(response, setAdminSession(response, result)); };
export const logout = async (request, response) => { const { refreshToken } = refreshCredentials(request); await auth.logout(refreshToken); response.append('set-cookie', clearCookie(refreshCookieName, true)); response.append('set-cookie', clearCookie(csrfCookieName)); return successResponse(response, null, { message: 'Logged out' }); };
export const me = async (request, response) => successResponse(response, request.user);

export const dashboard = async (request, response) => successResponse(response, await admin.dashboard(request.scope));
export const driverWorkspace = async (request, response) => successResponse(response, await admin.driverWorkspace(request.params.id, request.scope));
export const driverIdentityAvailability = async (request, response) => successResponse(response, await admin.driverIdentityAvailability(request.body));
export const reportOverview = async (request, response) => successResponse(response, await admin.reportOverview(request.scope));
export const exportReport = async (request, response) => {
  const csv = await admin.exportOrdersCsv(request.scope);
  response.set('content-type', 'text/csv; charset=utf-8');
  response.set('content-disposition', `attachment; filename="wolan-orders-${new Date().toISOString().slice(0, 10)}.csv"`);
  return response.send(csv);
};
export const saveSettings = async (request, response) => successResponse(response, await admin.saveSettings(request.body, request.actor), { message: 'Settings saved' });
export const uploadFiles = async (request, response) => successResponse(response, await uploads.upload(request.files, { folder: request.body.folder }), { statusCode: 201, message: 'Files uploaded' });

export const listUsers = async (request, response) => successResponse(response, await admin.listUsers(request.scope, request.query));
export const createUser = async (request, response) => successResponse(response, await admin.createUser(request.body, request.actor), { statusCode: 201, message: 'User created' });
export const updateUser = async (request, response) => successResponse(response, await admin.updateUser(request.params.id, request.scope, request.body, request.actor), { message: 'User updated' });

export const createNotification = async (request, response) => successResponse(response, await notifications.create(request.body, request.actor), { statusCode: 201, message: 'Notification created' });
export const unreadNotificationCount = async (request, response) => successResponse(response, await admin.unreadNotificationCount(request.scope));
export const markNotificationRead = async (request, response) => successResponse(response, await admin.markNotificationRead(request.params.id, request.scope, request.actor), { message: 'Notification marked as read' });
export const markAllNotificationsRead = async (request, response) => successResponse(response, await admin.markAllNotificationsRead(request.scope, request.actor), { message: 'Notifications marked as read' });

export const resourceList = (name) => async (request, response) => successResponse(response, await admin.listResource(name, request.scope, request.query));
export const resourceGet = (name) => async (request, response) => successResponse(response, await admin.getResource(name, request.params.id, request.scope));
export const resourceCreate = (name) => async (request, response) => successResponse(response, await admin.createResource(name, request.body, request.actor), { statusCode: 201, message: 'Created' });
export const resourceUpdate = (name) => async (request, response) => successResponse(response, await admin.updateResource(name, request.params.id, request.scope, request.body, request.actor));
export const resourceDelete = (name) => async (request, response) => successResponse(response, await admin.deleteResource(name, request.params.id, request.scope, request.actor), { message: 'Deleted' });

export const listOrders = async (request, response) => successResponse(response, await orders.list(request.scope, request.query));
export const getOrder = async (request, response) => successResponse(response, await orders.get(request.params.id, request.scope));
export const createOrder = async (request, response) => successResponse(response, await orders.create(request.body, request.actor), { statusCode: 201, message: 'Order created' });
export const quoteOrder = async (request, response) => successResponse(response, orders.quote(request.body));
export const verifyPickup = async (request, response) => successResponse(response, await orders.verifyPickup(request.params.id, request.body.key, request.scope, request.actor), { message: 'Merchant handover verified' });
export const scanAtHub = async (request, response) => successResponse(response, await orders.scanAtHub(request.params.id, request.body.code, request.scope, request.actor), { message: 'Package scanned into hub' });
export const assignOrder = async (request, response) => successResponse(response, await orders.assign(request.params.id, request.body.driverId, request.scope, request.actor), { message: 'Driver assigned' });
export const transitionOrder = async (request, response) => successResponse(response, await orders.transition(request.params.id, request.body.status, request.scope, request.actor, request.body.note));

export const publicTrack = async (request, response) => successResponse(response, await publicPortal.track(request.params.token));
export const submitRating = async (request, response) => successResponse(response, await publicPortal.submitRating(request.body), { statusCode: 201, message: 'Rating submitted' });

export const ingestTracking = async (request, response) => {
  return successResponse(response, await tracking.record(request.body, { hubId: request.body.hubId, actorId: null }), { statusCode: 202, message: 'Tracking sample accepted' });
};
