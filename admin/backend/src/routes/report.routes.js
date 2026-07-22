import { Router } from 'express';
import { authorize } from '@wolan/shared/middleware';
import { reportQuerySchema, validate } from '@wolan/shared/validation';
import * as controller from '../controllers/report.controller.js';
import { route } from './route.utils.js';

export const reportRoutes = Router();

reportRoutes.get('/reports/overview', authorize('report:read', 'report:*'), validate(reportQuerySchema, 'query'), route(controller.reportOverview));
reportRoutes.get('/reports/export', authorize('report:read', 'report:*'), validate(reportQuerySchema, 'query'), route(controller.exportReport));
