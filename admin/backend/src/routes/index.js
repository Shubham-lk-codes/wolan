import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { applyHubScope, authorize, createAuthenticate, createWebhookVerifier, idempotency, validate } from '@wolan/shared/middleware';
import { createOrderSchema, hubIdSchema, loginSchema, notificationCreateSchema, objectIdSchema, orderListQuerySchema, orderStatusSchema, paginationSchema, quoteOrderSchema, refreshSchema, trackingSampleSchema, userSchema } from '@wolan/shared/validation';
import { z } from 'zod';
import multer from 'multer';
import { AppError } from '@wolan/shared/utils';
import * as controller from '../controllers/platform.controller.js';
import { env } from '../config/env.js';
import { liveMapRouter } from '../modules/live-map/live-map.routes.js';

const asyncRoute = (handler) => (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
const authenticate = createAuthenticate({ secret: env.jwtAccessSecret, issuer: env.jwtIssuer, audience: env.jwtAudience });
const verifyTrackingWebhook = createWebhookVerifier({ secret: env.trackingWebhookSecret });
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
const idParams = z.object({ id: objectIdSchema }).strict();
const flexibleBody = z.record(z.string(), z.unknown());
const driverIdentityAvailabilitySchema = z.object({
  email: z.email().optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  plateNumber: z.string().trim().min(2).max(32).optional(),
}).strict().refine((value) => value.email || value.phone || value.plateNumber, { message: 'Email, phone, or vehicle plate is required' });
const allowedUploads = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 10 }, fileFilter: (_request, file, callback) => callback(allowedUploads.has(file.mimetype) ? null : new AppError(`Unsupported file type: ${file.mimetype}`, 422, 'UPLOAD_TYPE_NOT_ALLOWED'), allowedUploads.has(file.mimetype)) });

export const adminRouter = Router();
adminRouter.post('/auth/login', authLimiter, validate(loginSchema), asyncRoute(controller.login));
adminRouter.post('/auth/refresh', authLimiter, validate(z.object({}).strict()), asyncRoute(controller.refresh));
adminRouter.post('/auth/logout', validate(z.object({}).strict()), asyncRoute(controller.logout));
adminRouter.use(authenticate);
adminRouter.get('/auth/me', asyncRoute(controller.me));
adminRouter.use(applyHubScope);
adminRouter.use(idempotency());
adminRouter.get('/dashboard', authorize('dashboard:read'), asyncRoute(controller.dashboard));
adminRouter.get('/dashboard/stats', authorize('dashboard:read'), asyncRoute(controller.dashboard));
adminRouter.get('/users', authorize('user:read', 'hub:*'), validate(paginationSchema, 'query'), asyncRoute(controller.listUsers));
adminRouter.post('/users', authorize('user:create', 'hub:*'), validate(userSchema), asyncRoute(controller.createUser));
adminRouter.patch('/users/:id', authorize('user:update', 'hub:*'), validate(idParams, 'params'), validate(flexibleBody), asyncRoute(controller.updateUser));
adminRouter.get('/reports/overview', authorize('report:read', 'report:*'), asyncRoute(controller.reportOverview));
adminRouter.get('/reports/export', authorize('report:read', 'report:*'), asyncRoute(controller.exportReport));
adminRouter.put('/settings', authorize('setting:update', 'setting:*'), validate(flexibleBody), asyncRoute(controller.saveSettings));
adminRouter.post('/upload', authorize('upload:create', 'upload:*'), upload.array('files', 10), asyncRoute(controller.uploadFiles));
adminRouter.get('/notifications/unread-count', authorize('notification:read', 'notification:*'), asyncRoute(controller.unreadNotificationCount));
adminRouter.post('/notifications', authorize('notification:create', 'notification:*'), validate(notificationCreateSchema), asyncRoute(controller.createNotification));
adminRouter.patch('/notifications/read-all', authorize('notification:update', 'notification:*'), asyncRoute(controller.markAllNotificationsRead));
adminRouter.patch('/notifications/:id/read', authorize('notification:update', 'notification:*'), validate(idParams, 'params'), asyncRoute(controller.markNotificationRead));
adminRouter.get('/drivers/:id/workspace', authorize('driver:read', 'driver:*'), validate(idParams, 'params'), asyncRoute(controller.driverWorkspace));
adminRouter.post('/drivers/check-availability', authorize('driver:create', 'driver:*'), validate(driverIdentityAvailabilitySchema), asyncRoute(controller.driverIdentityAvailability));
adminRouter.use('/live-map', liveMapRouter);

const crudResources = ['hubs', 'merchants', 'drivers', 'packages', 'trackers', 'payments', 'incidents', 'notifications', 'settings', 'zones', 'reports', 'referrals', 'customers', 'alerts', 'tickets', 'audit'];
for (const resource of crudResources) {
  const singular = resource === 'hubs' ? 'hub' : resource.replace(/s$/, '');
  adminRouter.get(`/${resource}`, authorize(`${singular}:read`, `${singular}:*`), validate(paginationSchema, 'query'), asyncRoute(controller.resourceList(resource)));
  adminRouter.get(`/${resource}/:id`, authorize(`${singular}:read`, `${singular}:*`), validate(idParams, 'params'), asyncRoute(controller.resourceGet(resource)));
  if (resource !== 'audit') {
    if (resource !== 'notifications') adminRouter.post(`/${resource}`, authorize(`${singular}:create`, `${singular}:*`), validate(flexibleBody), asyncRoute(controller.resourceCreate(resource)));
    adminRouter.patch(`/${resource}/:id`, authorize(`${singular}:update`, `${singular}:*`), validate(idParams, 'params'), validate(flexibleBody), asyncRoute(controller.resourceUpdate(resource)));
    adminRouter.delete(`/${resource}/:id`, authorize(`${singular}:delete`, `${singular}:*`), validate(idParams, 'params'), asyncRoute(controller.resourceDelete(resource)));
  }
}

adminRouter.get('/orders', authorize('order:read'), validate(orderListQuerySchema, 'query'), asyncRoute(controller.listOrders));
adminRouter.get('/orders/:id', authorize('order:read'), validate(idParams, 'params'), asyncRoute(controller.getOrder));
adminRouter.post('/orders', authorize('order:create'), validate(createOrderSchema), asyncRoute(controller.createOrder));
adminRouter.post('/orders/quote', authorize('order:create'), validate(quoteOrderSchema), asyncRoute(controller.quoteOrder));
adminRouter.patch('/orders/:id/verify-pickup', authorize('order:update'), validate(idParams, 'params'), validate(z.object({ key: z.string().regex(/^\d{6}$/) }).strict()), asyncRoute(controller.verifyPickup));
adminRouter.patch('/orders/:id/scan', authorize('order:update'), validate(idParams, 'params'), validate(z.object({ code: z.string().trim().min(4).max(100) }).strict()), asyncRoute(controller.scanAtHub));
adminRouter.patch('/orders/:id/assign', authorize('order:update'), validate(idParams, 'params'), validate(z.object({ driverId: objectIdSchema }).strict()), asyncRoute(controller.assignOrder));
adminRouter.patch('/orders/:id/status', authorize('order:update'), validate(idParams, 'params'), validate(orderStatusSchema), asyncRoute(controller.transitionOrder));

export const publicRouter = Router();
publicRouter.get('/tracking/:token', asyncRoute(controller.publicTrack));
publicRouter.post('/ratings', rateLimit({ windowMs: 60_000, limit: 5 }), validate(z.object({ hubId: hubIdSchema, orderId: objectIdSchema, targetType: z.enum(['DRIVER', 'MERCHANT', 'SERVICE']), targetId: objectIdSchema.optional(), customerId: objectIdSchema.optional(), score: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }).strict()), asyncRoute(controller.submitRating));

export const trackingRouter = Router();
trackingRouter.post('/device/location', rateLimit({ windowMs: 60_000, limit: 300 }), validate(trackingSampleSchema.extend({ hubId: hubIdSchema })), verifyTrackingWebhook, asyncRoute(controller.ingestTracking));
trackingRouter.post('/provider/webhook', rateLimit({ windowMs: 60_000, limit: 300 }), validate(trackingSampleSchema.extend({ hubId: hubIdSchema })), verifyTrackingWebhook, asyncRoute(controller.ingestTracking));
