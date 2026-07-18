import { Router } from 'express';
import { validate } from '@wolan/shared/middleware';
import { objectIdSchema, pointSchema } from '@wolan/shared/validation';
import { z } from 'zod';
import * as controller from '../controllers/tracking.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);
const id = z.object({ id: objectIdSchema }).strict();
const location = z.object({
  location: pointSchema,
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().min(0).optional(),
  battery: z.number().min(0).max(100).optional(),
  signal: z.number().min(0).max(100).optional(),
  recordedAt: z.coerce.date().default(() => new Date()),
}).strict();

export const trackingRoutes = Router();

trackingRoutes.post(
  '/orders/:id/scan-package',
  validate(id, 'params'),
  validate(z.object({
    packageTrackingId: z.string().trim().min(4).max(100),
    trackerSerial: z.string().trim().min(4).max(100),
  }).strict()),
  route(controller.scanPackage),
);
trackingRoutes.post('/location', validate(location), route(controller.updateLocation));
trackingRoutes.post('/heartbeat', route(controller.heartbeat));
