import { Router } from 'express';
import { validate } from '@wolan/shared/middleware';
import { driverStatusSchema } from '@wolan/shared/validation';
import * as controller from '../controllers/status.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

export const statusRoutes = Router();

statusRoutes.patch('/status', validate(driverStatusSchema), route(controller.updateStatus));
