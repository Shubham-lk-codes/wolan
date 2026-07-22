import { Router } from 'express';
import { authorize, validate } from '@wolan/shared/middleware';
import { hubIdSchema } from '@wolan/shared/validation';
import { z } from 'zod';
import { getLiveMap } from './live-map.controller.js';

const asyncRoute = (handler) => (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
const liveMapQuerySchema = z.object({ hubId: hubIdSchema.optional() }).strict();

export const liveMapRouter = Router();
liveMapRouter.get('/', authorize('tracking:read', 'tracking:*'), validate(liveMapQuerySchema, 'query'), asyncRoute(getLiveMap));
