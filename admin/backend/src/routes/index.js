import { Router } from 'express';
import { applyHubScope, createAuthenticate, idempotency } from '@wolan/shared/middleware';
import { env } from '../config/env.js';
import { authRoutes, protectedAuthRoutes } from './auth.routes.js';
import { dashboardRoutes } from './dashboard.routes.js';
import { driverRoutes } from './driver.routes.js';
import { hubManagerRoutes } from './hub-manager.routes.js';
import { liveMapRouter } from './live-map.routes.js';
import { notificationRoutes } from './notification.routes.js';
import { orderRoutes } from './order.routes.js';
import { publicRoutes } from './public.routes.js';
import { reportRoutes } from './report.routes.js';
import { resourceRoutes } from './resource.routes.js';
import { settingsRoutes } from './settings.routes.js';
import { trackingRoutes } from './tracking.routes.js';
import { uploadRoutes } from './upload.routes.js';
import { userRoutes } from './user.routes.js';

const authenticate = createAuthenticate({
  secret: env.jwtAccessSecret,
  issuer: env.jwtIssuer,
  audience: env.jwtAudience,
});

export const adminRouter = Router();

adminRouter.use('/auth', authRoutes);
adminRouter.use(authenticate);
adminRouter.use('/auth', protectedAuthRoutes);
adminRouter.use(applyHubScope, idempotency());
adminRouter.use(
  dashboardRoutes,
  hubManagerRoutes,
  userRoutes,
  reportRoutes,
  settingsRoutes,
  uploadRoutes,
  notificationRoutes,
  driverRoutes,
);
adminRouter.use('/live-map', liveMapRouter);
adminRouter.use(resourceRoutes, orderRoutes);

export const publicRouter = publicRoutes;
export const trackingRouter = trackingRoutes;
