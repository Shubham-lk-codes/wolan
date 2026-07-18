import { Router } from 'express';
import * as controller from '../controllers/cod.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

export const codRoutes = Router();

codRoutes.get('/cod', route(controller.cod));
