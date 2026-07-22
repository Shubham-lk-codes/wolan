import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { validate } from '@wolan/shared/middleware';
import { loginSchema } from '@wolan/shared/validation';
import { z } from 'zod';
import * as controller from '../controllers/auth.controller.js';
import { route } from './route.utils.js';

const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
const emptyBody = z.object({}).strict();

export const authRoutes = Router();
export const protectedAuthRoutes = Router();

authRoutes.post('/login', authLimiter, validate(loginSchema), route(controller.login));
authRoutes.post('/refresh', authLimiter, validate(emptyBody), route(controller.refresh));
authRoutes.post('/logout', validate(emptyBody), route(controller.logout));
protectedAuthRoutes.get('/me', route(controller.me));
