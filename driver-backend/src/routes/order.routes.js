import { Router } from 'express';
import { validate } from '@wolan/shared/middleware';
import { objectIdSchema, orderListQuerySchema, paginationSchema, pointSchema } from '@wolan/shared/validation';
import { z } from 'zod';
import * as controller from '../controllers/order.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);
const id = z.object({ id: objectIdSchema }).strict();
const media = z.object({
  url: z.url(),
  publicId: z.string().optional(),
  resourceType: z.string().optional(),
}).strict();
export const failureSchema = z.object({
  reason: z.enum(['CUSTOMER_UNAVAILABLE', 'CUSTOMER_REFUSED', 'WRONG_ADDRESS', 'PACKAGE_DAMAGED', 'OTHER']).default('OTHER'),
  note: z.string().trim().min(2).max(500),
  photos: z.array(media).max(5).default([]),
  location: pointSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.reason === 'CUSTOMER_UNAVAILABLE' && value.photos.length === 0) {
    context.addIssue({ code: 'custom', path: ['photos'], message: 'Photo evidence is required when the customer is unavailable' });
  }
});

export const orderRoutes = Router();

orderRoutes.get('/orders', validate(orderListQuerySchema, 'query'), route(controller.listOrders));
orderRoutes.get('/orders/available', validate(paginationSchema, 'query'), route(controller.availableOrders));
orderRoutes.get('/orders/:id', validate(id, 'params'), route(controller.getOrder));
orderRoutes.post('/orders/:id/accept', validate(id, 'params'), route(controller.accept));
orderRoutes.post(
  '/orders/:id/reject',
  validate(id, 'params'),
  validate(z.object({ reason: z.string().trim().min(2).max(500) }).strict()),
  route(controller.reject),
);
orderRoutes.post('/orders/:id/pickup', validate(id, 'params'), route(controller.pickup));
orderRoutes.post('/orders/:id/at-hub', validate(id, 'params'), route(controller.atHub));
orderRoutes.post('/orders/:id/start-delivery', validate(id, 'params'), route(controller.startDelivery));
orderRoutes.post('/orders/:id/fail', validate(id, 'params'), validate(failureSchema), route(controller.fail));
orderRoutes.post(
  '/orders/:id/return',
  validate(id, 'params'),
  validate(z.object({ note: z.string().trim().min(2).max(500) }).strict()),
  route(controller.returnOrder),
);
orderRoutes.post('/orders/:id/delivery-otp', validate(id, 'params'), route(controller.requestDeliveryOtp));
orderRoutes.post(
  '/orders/:id/complete',
  validate(id, 'params'),
  validate(z.object({
    otpId: objectIdSchema,
    code: z.string().regex(/^\d{4,6}$/),
    recipientName: z.string().trim().min(2).max(120).optional(),
    photos: z.array(media).min(1).max(5),
    location: pointSchema.optional(),
  }).strict()),
  route(controller.complete),
);
