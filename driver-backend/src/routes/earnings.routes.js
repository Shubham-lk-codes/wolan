import { Router } from 'express';
import * as controller from '../controllers/earnings.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

export const earningsRoutes = Router();

earningsRoutes.get('/earnings', route(controller.earnings));
