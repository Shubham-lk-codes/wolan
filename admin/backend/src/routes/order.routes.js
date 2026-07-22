import { Router } from 'express';
import { authorize, validate } from '@wolan/shared/middleware';
import {
  createOrderSchema,
  objectIdSchema,
  orderListQuerySchema,
  orderStatusSchema,
  quoteOrderSchema,
} from '@wolan/shared/validation';
import { z } from 'zod';
import * as controller from '../controllers/order.controller.js';
import { idParams, route } from './route.utils.js';

const pickupKeySchema = z.object({ key: z.string().regex(/^\d{6}$/) }).strict();
const hubScanSchema = z.object({ code: z.string().trim().min(4).max(100) }).strict();
const driverAssignmentSchema = z.object({ driverId: objectIdSchema }).strict();

export const orderRoutes = Router();

orderRoutes.get('/orders', authorize('order:read'), validate(orderListQuerySchema, 'query'), route(controller.listOrders));
orderRoutes.get('/orders/:id', authorize('order:read'), validate(idParams, 'params'), route(controller.getOrder));
orderRoutes.post('/orders', authorize('order:create'), validate(createOrderSchema), route(controller.createOrder));
orderRoutes.post('/orders/quote', authorize('order:create'), validate(quoteOrderSchema), route(controller.quoteOrder));
orderRoutes.patch('/orders/:id/verify-pickup', authorize('order:update'), validate(idParams, 'params'), validate(pickupKeySchema), route(controller.verifyPickup));
orderRoutes.patch('/orders/:id/scan', authorize('order:update'), validate(idParams, 'params'), validate(hubScanSchema), route(controller.scanAtHub));
orderRoutes.patch('/orders/:id/assign', authorize('order:update'), validate(idParams, 'params'), validate(driverAssignmentSchema), route(controller.assignOrder));
orderRoutes.patch('/orders/:id/status', authorize('order:update'), validate(idParams, 'params'), validate(orderStatusSchema), route(controller.transitionOrder));
