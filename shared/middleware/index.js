import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { IdempotencyKey, User } from '../models/index.js';
import { normalizeRole, SYSTEM_ACTOR_ID } from '../constants/index.js';
import { hasPermission, resolveHubScope } from '../permissions/index.js';
import { AppError } from '../utils/index.js';
export { validate } from '../validation/index.js';

export function requestContext(request, response, next) {
  request.id = request.get('x-request-id') || randomUUID();
  response.set('x-request-id', request.id);
  request.context = Object.freeze({ requestId: request.id, startedAt: Date.now() });
  next();
}

export function createAuthenticate({ secret, issuer = 'wolan-logistics', audience = 'wolan-platform' }) {
  if (!secret) throw new Error('JWT access secret is required');
  return async function authenticate(request, _response, next) {
    try {
      const authorization = request.get('authorization');
      if (!authorization?.startsWith('Bearer ')) throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      const payload = jwt.verify(authorization.slice(7), secret, { issuer, audience });
      if (payload.typ !== 'access') throw new AppError('Invalid access token type', 401, 'INVALID_TOKEN');
      const user = await User.findOne({ _id: payload.sub, deletedAt: null, status: 'ACTIVE' }).select('+tokenVersion');
      if (!user || user.tokenVersion !== payload.ver) throw new AppError('Session is no longer valid', 401, 'SESSION_REVOKED');
      user.role = normalizeRole(user.role);
      request.user = user;
      request.actor = Object.freeze({ actorId: user._id, role: user.role, hubId: user.hubId });
      next();
    } catch (error) {
      if (error instanceof AppError) return next(error);
      return next(new AppError('Invalid or expired access token', 401, 'INVALID_TOKEN'));
    }
  };
}

export const authorize = (...permissions) => (request, _response, next) => {
  if (!request.user) return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
  if (!permissions.some((permission) => hasPermission(request.user, permission))) return next(new AppError('Permission denied', 403, 'FORBIDDEN'));
  return next();
};

export const authorizeRoles = (...roles) => (request, _response, next) => {
  if (!request.user) return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
  const role = normalizeRole(request.user.role);
  if (!hasPermission(request.user, '*') && !roles.map(normalizeRole).includes(role)) return next(new AppError('Role access denied', 403, 'FORBIDDEN'));
  return next();
};

export function applyHubScope(request, _response, next) {
  try {
    request.scope = resolveHubScope(request.user, request.query?.hubId ?? request.body?.hubId ?? request.params?.hubId);
    if (request.scope.hubId && typeof request.scope.hubId === 'string') request.actor = Object.freeze({ ...request.actor, hubId: request.scope.hubId });
    next();
  } catch (error) { next(error); }
}

export function notFound(request, _response, next) {
  next(new AppError(`Route not found: ${request.method} ${request.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
}

export function errorHandler(error, request, response, _next) {
  let statusCode = error.statusCode ?? 500;
  let code = error.code ?? 'INTERNAL_ERROR';
  let message = error.message ?? 'Internal server error';
  let details = error.details;
  if (error instanceof mongoose.Error.ValidationError || error.name === 'ValidationError') { statusCode = error.statusCode ?? 422; code = error.code ?? 'VALIDATION_FAILED'; }
  if (error?.code === 11000) {
    const fields = Object.keys(error.keyPattern ?? error.keyValue ?? {});
    const field = fields[0];
    const conflictMessages = {
      email: 'This email is already assigned to another account',
      phone: 'This phone number is already assigned to another account',
      plateNumber: 'This vehicle plate is already assigned to another driver',
      driverCode: 'A generated driver code conflicted; please submit again',
    };
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    message = conflictMessages[field] ?? 'A resource with the same unique value already exists';
    details = fields.length ? { fields } : undefined;
  }
  if (error instanceof mongoose.Error.CastError) { statusCode = 400; code = 'INVALID_ID'; message = 'Invalid resource identifier'; }
  if (error?.name === 'MulterError') { statusCode = 422; code = 'UPLOAD_VALIDATION_FAILED'; }
  const body = { success: false, message, error: { code, requestId: request.id, ...(details ? { details } : {}) } };
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) body.error.stack = error.stack;
  response.status(statusCode).json(body);
}

function containsUnsafeField(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsUnsafeField);
  return Object.entries(value).some(([key, nestedValue]) => key.startsWith('$') || key.includes('.') || containsUnsafeField(nestedValue));
}

export function sanitizeRequest(request, _response, next) {
  for (const source of ['body', 'query', 'params']) {
    if (containsUnsafeField(request[source])) return next(new AppError('Unsafe request field', 400, 'UNSAFE_INPUT'));
  }
  next();
}

export function createWebhookVerifier({ secret, toleranceMs = 5 * 60_000 } = {}) {
  if (!secret) throw new Error('Webhook secret is required');
  return async function verifyWebhook(request, response, next) {
    try {
      const timestampHeader = request.get('x-wolan-timestamp');
      const eventId = request.get('x-wolan-event-id');
      const suppliedHeader = request.get('x-wolan-signature') ?? '';
      const suppliedHex = suppliedHeader.replace(/^sha256=/i, '');
      const timestamp = Number(timestampHeader);
      const timestampMs = timestamp < 10_000_000_000 ? timestamp * 1_000 : timestamp;
      if (!timestampHeader || !Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > toleranceMs) throw new AppError('Webhook timestamp is invalid or stale', 401, 'INVALID_WEBHOOK_TIMESTAMP');
      if (!eventId || eventId.length > 200) throw new AppError('Webhook event id is required', 400, 'WEBHOOK_EVENT_ID_REQUIRED');
      const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}));
      const expected = Buffer.from(createHmac('sha256', secret).update(`${timestampHeader}.`).update(rawBody).digest('hex'));
      const supplied = Buffer.from(suppliedHex);
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new AppError('Webhook signature is invalid', 401, 'INVALID_WEBHOOK_SIGNATURE');
      const replay = await IdempotencyKey.create({
        hubId: request.body?.hubId, key: `webhook:${eventId}`, actorId: SYSTEM_ACTOR_ID,
        requestHash: createHmac('sha256', secret).update(rawBody).digest('hex'), status: 'RECEIVED',
        createdBy: SYSTEM_ACTOR_ID, updatedBy: SYSTEM_ACTOR_ID, expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      }).catch((error) => {
        if (error?.code === 11000) throw new AppError('Webhook event was already processed', 409, 'WEBHOOK_REPLAY');
        throw error;
      });
      response.on('finish', () => {
        if (response.statusCode >= 400) IdempotencyKey.deleteOne({ _id: replay._id, status: 'RECEIVED' }).catch(() => {});
        else IdempotencyKey.updateOne({ _id: replay._id }, { $set: { status: 'PROCESSED', responseStatus: response.statusCode } }).catch(() => {});
      });
      request.webhook = Object.freeze({ eventId, timestamp: new Date(timestampMs) });
      next();
    } catch (error) { next(error); }
  };
}

export function idempotency({ ttlMs = 24 * 60 * 60_000 } = {}) {
  return async function handleIdempotency(request, response, next) {
    const key = request.get('idempotency-key');
    if (!key || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return next();
    try {
      if (key.length > 200) throw new AppError('Idempotency key is too long', 400, 'INVALID_IDEMPOTENCY_KEY');
      if (!request.user || !request.actor?.actorId || !request.actor?.hubId) throw new AppError('Idempotency requires an authenticated hub scope', 400, 'IDEMPOTENCY_SCOPE_REQUIRED');
      const requestHash = createHash('sha256').update(JSON.stringify({ method: request.method, path: request.originalUrl, body: request.body })).digest('hex');
      const filter = { hubId: request.actor.hubId, actorId: request.actor.actorId, key, deletedAt: null };
      let record = await IdempotencyKey.findOne(filter);
      if (record) {
        if (record.requestHash !== requestHash) throw new AppError('Idempotency key was used with a different request', 409, 'IDEMPOTENCY_KEY_CONFLICT');
        if (record.responseStatus && record.responseBody !== undefined) return response.status(record.responseStatus).json(record.responseBody);
        throw new AppError('An identical request is already being processed', 409, 'IDEMPOTENCY_IN_PROGRESS');
      }
      try {
        record = await IdempotencyKey.create({ ...filter, requestHash, status: 'PROCESSING', createdBy: request.actor.actorId, updatedBy: request.actor.actorId, expiresAt: new Date(Date.now() + ttlMs) });
      } catch (error) {
        if (error?.code === 11000) return handleIdempotency(request, response, next);
        throw error;
      }
      response.set('idempotency-key', key);
      const sendJson = response.json.bind(response);
      response.json = (body) => {
        const update = response.statusCode < 500
          ? { $set: { responseStatus: response.statusCode, responseBody: body, status: 'COMPLETED', updatedBy: request.actor.actorId } }
          : { $set: { status: 'FAILED', updatedBy: request.actor.actorId } };
        IdempotencyKey.updateOne({ _id: record._id }, update).catch(() => {});
        return sendJson(body);
      };
      return next();
    } catch (error) { return next(error); }
  };
}
