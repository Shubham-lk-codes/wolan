import { Router } from 'express';
import { validate } from '@wolan/shared/middleware';
import { objectIdSchema, pointSchema } from '@wolan/shared/validation';
import { z } from 'zod';
import * as controller from '../controllers/incident.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);
const media = z.object({ url: z.url(), publicId: z.string().optional(), resourceType: z.string().optional() }).strict();

export const incidentRoutes = Router();

incidentRoutes.post(
  '/incidents',
  validate(z.object({
    type: z.enum(['ACCIDENT', 'THEFT', 'MECHANICAL_FAILURE', 'POLICE_STOP', 'PACKAGE_DAMAGE', 'BROKEN_SEAL', 'LOST_PACKAGE', 'OTHER']),
    orderId: objectIdSchema.optional(),
    packageId: objectIdSchema.optional(),
    description: z.string().trim().min(3).max(2000),
    location: pointSchema.optional(),
    photos: z.array(media).max(5).default([]),
  }).strict()),
  route(controller.reportIncident),
);
