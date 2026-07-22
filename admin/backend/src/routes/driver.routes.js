import { Router } from 'express';
import { authorize, validate } from '@wolan/shared/middleware';
import { z } from 'zod';
import * as controller from '../controllers/driver.controller.js';
import { idParams, route } from './route.utils.js';

const identityAvailabilitySchema = z.object({
  email: z.email().optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  plateNumber: z.string().trim().min(2).max(32).optional(),
}).strict().refine((value) => value.email || value.phone || value.plateNumber, {
  message: 'Email, phone, or vehicle plate is required',
});

export const driverRoutes = Router();

driverRoutes.get('/drivers/:id/workspace', authorize('driver:read', 'driver:*'), validate(idParams, 'params'), route(controller.driverWorkspace));
driverRoutes.post('/drivers/check-availability', authorize('driver:create', 'driver:*'), validate(identityAvailabilitySchema), route(controller.driverIdentityAvailability));
