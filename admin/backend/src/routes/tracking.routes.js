import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createWebhookVerifier, validate } from '@wolan/shared/middleware';
import { hubIdSchema, trackingSampleSchema } from '@wolan/shared/validation';
import * as controller from '../controllers/tracking.controller.js';
import { env } from '../config/env.js';
import { route } from './route.utils.js';

const verifyTrackingWebhook = createWebhookVerifier({ secret: env.trackingWebhookSecret });
const trackingPayloadSchema = trackingSampleSchema.extend({ hubId: hubIdSchema });
const trackingLimiter = () => rateLimit({ windowMs: 60_000, limit: 300 });

export const trackingRoutes = Router();

trackingRoutes.post('/device/location', trackingLimiter(), validate(trackingPayloadSchema), verifyTrackingWebhook, route(controller.ingestTracking));
trackingRoutes.post('/provider/webhook', trackingLimiter(), validate(trackingPayloadSchema), verifyTrackingWebhook, route(controller.ingestTracking));
