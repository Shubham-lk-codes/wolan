import { Router } from 'express';
import * as controller from '../controllers/payment.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

export const paymentRoutes = Router();

paymentRoutes.get('/finance', route(controller.finance));
paymentRoutes.get('/cod', route(controller.cod));
paymentRoutes.get('/payments', route(controller.payments));
paymentRoutes.get('/payouts', route(controller.payouts));
