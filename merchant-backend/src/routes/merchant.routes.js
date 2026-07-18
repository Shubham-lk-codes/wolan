import { Router } from 'express';
import { validate } from '@wolan/shared/middleware';
import { z } from 'zod';
import * as controller from '../controllers/merchant.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

export const merchantRoutes = Router();

merchantRoutes.get('/profile', route(controller.profile));
merchantRoutes.patch('/profile', validate(z.record(z.string(), z.unknown())), route(controller.updateProfile));
