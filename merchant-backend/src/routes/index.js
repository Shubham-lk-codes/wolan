import { Router } from 'express';
import { applyHubScope, createAuthenticate, idempotency } from '@wolan/shared/middleware';
import { env } from '../config/env.js';
import { authRoutes } from './auth.routes.js';
import { dashboardRoutes } from './dashboard.routes.js';
import { merchantRoutes } from './merchant.routes.js';
import { notificationRoutes } from './notification.routes.js';
import { orderRoutes } from './order.routes.js';
import { paymentRoutes } from './payment.routes.js';
import { referralRoutes } from './referral.routes.js';
import { trackingRoutes } from './tracking.routes.js';

const authenticate = createAuthenticate({ secret: env.jwtAccessSecret, issuer: env.jwtIssuer, audience: env.jwtAudience });

export const merchantRouter = Router();
merchantRouter.use('/auth', authRoutes);
merchantRouter.use(authenticate, applyHubScope);
merchantRouter.use(idempotency());
merchantRouter.use(
  merchantRoutes,
  dashboardRoutes,
  orderRoutes,
  trackingRoutes,
  paymentRoutes,
  referralRoutes,
  notificationRoutes,
);
