import { Router } from 'express';
import { validate } from '@wolan/shared/middleware';
import { objectIdSchema } from '@wolan/shared/validation';
import { z } from 'zod';
import * as controller from '../controllers/tracking.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);
const id = z.object({ id: objectIdSchema }).strict();

export const trackingRoutes = Router();

trackingRoutes.get('/orders/:id/tracking', validate(id, 'params'), route(controller.tracking));
