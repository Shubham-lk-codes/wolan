import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { validate } from '@wolan/shared/middleware';
import { hubIdSchema, objectIdSchema } from '@wolan/shared/validation';
import { z } from 'zod';
import * as controller from '../controllers/public.controller.js';
import { route } from './route.utils.js';

const ratingSchema = z.object({
  hubId: hubIdSchema,
  orderId: objectIdSchema,
  targetType: z.enum(['DRIVER', 'MERCHANT', 'SERVICE']),
  targetId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
}).strict();

export const publicRoutes = Router();

publicRoutes.get('/tracking/:token', route(controller.publicTrack));
publicRoutes.post('/ratings', rateLimit({ windowMs: 60_000, limit: 5 }), validate(ratingSchema), route(controller.submitRating));
