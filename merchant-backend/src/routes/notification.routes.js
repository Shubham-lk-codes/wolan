import { Router } from 'express';
import { validate } from '@wolan/shared/middleware';
import { objectIdSchema } from '@wolan/shared/validation';
import { z } from 'zod';
import * as controller from '../controllers/notification.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);
const id = z.object({ id: objectIdSchema }).strict();

export const notificationRoutes = Router();

notificationRoutes.get('/notifications', route(controller.notifications));
notificationRoutes.patch('/notifications/:id/read', validate(id, 'params'), route(controller.markNotificationRead));
