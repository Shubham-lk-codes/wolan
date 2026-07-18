import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { validate } from '@wolan/shared/middleware';
import {
  credentialResetRequestSchema,
  loginSchema,
  passwordResetSchema,
  refreshSchema,
} from '@wolan/shared/validation';
import * as controller from '../controllers/auth.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

export const authRoutes = Router();

authRoutes.post('/login', rateLimit({ windowMs: 15 * 60_000, limit: 10 }), validate(loginSchema), route(controller.login));
authRoutes.post('/refresh', validate(refreshSchema), route(controller.refresh));
authRoutes.post('/logout', validate(refreshSchema), route(controller.logout));
authRoutes.post('/forgot', rateLimit({ windowMs: 60 * 60_000, limit: 5 }), validate(credentialResetRequestSchema), route(controller.forgotCredentials));
authRoutes.post('/reset', rateLimit({ windowMs: 15 * 60_000, limit: 10 }), validate(passwordResetSchema), route(controller.resetCredentials));
