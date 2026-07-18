import { Router } from 'express';
import { validate } from '@wolan/shared/middleware';
import { createOrderSchema, objectIdSchema, orderListQuerySchema } from '@wolan/shared/validation';
import { z } from 'zod';
import * as controller from '../controllers/order.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);
const id = z.object({ id: objectIdSchema }).strict();

export const orderRoutes = Router();

orderRoutes.get('/orders', validate(orderListQuerySchema, 'query'), route(controller.listOrders));
orderRoutes.post('/orders', validate(createOrderSchema), route(controller.createOrder));
orderRoutes.get('/orders/:id', validate(id, 'params'), route(controller.getOrder));
orderRoutes.post('/orders/:id/send-off', validate(id, 'params'), route(controller.sendOff));
orderRoutes.post(
  '/orders/:id/cancel',
  validate(id, 'params'),
  validate(z.object({ reason: z.string().trim().min(2).max(500) }).strict()),
  route(controller.cancelOrder),
);
