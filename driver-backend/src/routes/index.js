import { Router } from 'express';
import { applyHubScope, createAuthenticate, idempotency } from '@wolan/shared/middleware';
import { env } from '../config/env.js';
import { authRoutes, protectedAuthRoutes } from './auth.routes.js';
import { codRoutes } from './cod.routes.js';
import { earningsRoutes } from './earnings.routes.js';
import { incidentRoutes } from './incident.routes.js';
import { notificationRoutes } from './notification.routes.js';
import { orderRoutes } from './order.routes.js';
import { profileRoutes } from './profile.routes.js';
import { statusRoutes } from './status.routes.js';
import { trackingRoutes } from './tracking.routes.js';

const authenticate = createAuthenticate({
  secret: env.jwtAccessSecret,
  issuer: env.jwtIssuer,
  audience: env.jwtAudience,
});

export const driverRouter = Router();

driverRouter.use('/auth', authRoutes);
driverRouter.use(authenticate, applyHubScope, idempotency());
driverRouter.use('/auth', protectedAuthRoutes);
driverRouter.use(
  profileRoutes,
  statusRoutes,
  orderRoutes,
  trackingRoutes,
  earningsRoutes,
  incidentRoutes,
  codRoutes,
  notificationRoutes,
);
