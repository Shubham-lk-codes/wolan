import { Router } from 'express';
import * as controller from '../controllers/dashboard.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

export const dashboardRoutes = Router();

dashboardRoutes.get('/dashboard', route(controller.dashboard));
