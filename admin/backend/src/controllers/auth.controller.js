import { randomBytes, timingSafeEqual } from 'node:crypto';
import { HQ_ROLES, ROLES } from '@wolan/shared/constants';
import { AuthService } from '@wolan/shared/services';
import { AppError, successResponse } from '@wolan/shared/utils';
import { env } from '../config/env.js';

const auth = new AuthService({
  accessSecret: env.jwtAccessSecret,
  refreshSecret: env.jwtRefreshSecret,
  accessExpiresIn: env.jwtAccessExpiresIn,
  refreshExpiresIn: env.jwtRefreshExpiresIn,
  issuer: env.jwtIssuer,
  audience: env.jwtAudience,
});

const allowedAdminRoles = new Set([
  ...HQ_ROLES,
  ROLES.REGIONAL_MANAGER,
  ROLES.HUB_MANAGER,
  ROLES.OPS_COORDINATOR,
]);
const refreshCookieName = 'wolan_refresh';
const csrfCookieName = 'wolan_csrf';

const parseCookies = (request) => Object.fromEntries(
  (request.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim().split('=').map(decodeURIComponent))
    .filter(([key]) => key),
);

const cookie = (name, value, { httpOnly = false, maxAge = 30 * 24 * 60 * 60 } = {}) =>
  `${name}=${encodeURIComponent(value)}; Path=/api/v1/admin/auth; Max-Age=${maxAge}; SameSite=Strict${httpOnly ? '; HttpOnly' : ''}${env.isProduction ? '; Secure' : ''}`;

const clearCookie = (name, httpOnly = false) => cookie(name, '', { httpOnly, maxAge: 0 });

async function requireAdminSession(result) {
  if (allowedAdminRoles.has(result.user.role)) return result;
  await auth.logout(result.refreshToken);
  throw new AppError('Admin account required', 403, 'ADMIN_ACCOUNT_REQUIRED');
}

function setAdminSession(response, result) {
  const csrfToken = randomBytes(24).toString('base64url');
  response.append('set-cookie', cookie(refreshCookieName, result.refreshToken, { httpOnly: true }));
  response.append('set-cookie', cookie(csrfCookieName, csrfToken));
  return { accessToken: result.accessToken, user: result.user, csrfToken };
}

function refreshTokenFrom(request) {
  const cookies = parseCookies(request);
  const supplied = Buffer.from(request.get('x-csrf-token') ?? '');
  const expected = Buffer.from(cookies[csrfCookieName] ?? '');
  if (!cookies[refreshCookieName] || !supplied.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new AppError('CSRF validation failed', 403, 'CSRF_VALIDATION_FAILED');
  }
  return cookies[refreshCookieName];
}

export async function login(request, response) {
  const session = await auth.login(request.body, { ip: request.ip, userAgent: request.get('user-agent') });
  const result = await requireAdminSession(session);
  return successResponse(response, setAdminSession(response, result), { message: 'Login successful' });
}

export async function refresh(request, response) {
  const session = await auth.refresh(refreshTokenFrom(request), { ip: request.ip, userAgent: request.get('user-agent') });
  const result = await requireAdminSession(session);
  return successResponse(response, setAdminSession(response, result));
}

export async function logout(request, response) {
  await auth.logout(refreshTokenFrom(request));
  response.append('set-cookie', clearCookie(refreshCookieName, true));
  response.append('set-cookie', clearCookie(csrfCookieName));
  return successResponse(response, null, { message: 'Logged out' });
}

export const me = async (request, response) => successResponse(response, request.user);
