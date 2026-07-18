import { Router } from 'express';
import * as controller from '../controllers/referral.controller.js';

const route = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

export const referralRoutes = Router();

referralRoutes.get('/referrals', route(controller.referrals));
