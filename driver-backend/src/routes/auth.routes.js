import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { validate } from '@wolan/shared/middleware';
import {
  credentialResetRequestSchema,
  loginSchema,
  phoneSchema,
  pinChangeSchema,
  pinResetSchema,
  refreshSchema,
} from '@wolan/shared/validation';
import { z } from 'zod';
import * as controller from '../controllers/auth.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);
const phoneAndPinSchema = z.object({
  phone: phoneSchema,
  pin: z.string().regex(/^\d{4,8}$/),
}).strict();
export const driverLoginSchema = z.union([phoneAndPinSchema, loginSchema]);

export const authRoutes = Router();
export const protectedAuthRoutes = Router();

authRoutes.post('/login', rateLimit({ windowMs: 15 * 60_000, limit: 10 }), validate(driverLoginSchema), route(controller.login));
authRoutes.post('/refresh', validate(refreshSchema), route(controller.refresh));
authRoutes.post('/logout', validate(refreshSchema), route(controller.logout));
authRoutes.post('/pin/forgot', rateLimit({ windowMs: 60 * 60_000, limit: 5 }), validate(credentialResetRequestSchema), route(controller.forgotPin));
authRoutes.post('/pin/reset', rateLimit({ windowMs: 15 * 60_000, limit: 10 }), validate(pinResetSchema), route(controller.resetPin));
protectedAuthRoutes.post('/pin/change', validate(pinChangeSchema), route(controller.changePin));
