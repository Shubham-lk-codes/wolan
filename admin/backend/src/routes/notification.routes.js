import { Router } from 'express';
import { authorize, validate } from '@wolan/shared/middleware';
import { notificationCreateSchema } from '@wolan/shared/validation';
import * as controller from '../controllers/notification.controller.js';
import { idParams, route } from './route.utils.js';

export const notificationRoutes = Router();

notificationRoutes.get('/notifications/unread-count', authorize('notification:read', 'notification:*'), route(controller.unreadNotificationCount));
notificationRoutes.post('/notifications', authorize('notification:create', 'notification:*'), validate(notificationCreateSchema), route(controller.createNotification));
notificationRoutes.patch('/notifications/read-all', authorize('notification:update', 'notification:*'), route(controller.markAllNotificationsRead));
notificationRoutes.patch('/notifications/:id/read', authorize('notification:update', 'notification:*'), validate(idParams, 'params'), route(controller.markNotificationRead));
