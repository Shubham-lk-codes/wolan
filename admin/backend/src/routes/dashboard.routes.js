import { Router } from 'express';
import { authorize } from '@wolan/shared/middleware';
import * as controller from '../controllers/dashboard.controller.js';
import { route } from './route.utils.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/dashboard', authorize('dashboard:read'), route(controller.dashboard));
dashboardRoutes.get('/dashboard/stats', authorize('dashboard:read'), route(controller.dashboard));
