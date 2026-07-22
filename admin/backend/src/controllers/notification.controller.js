import { successResponse } from '@wolan/shared/utils';
import { adminPortal, notificationService } from '../services/admin-services.js';

export const createNotification = async (request, response) =>
  successResponse(response, await notificationService.create(request.body, request.actor), {
    statusCode: 201,
    message: 'Notification created',
  });

export const unreadNotificationCount = async (request, response) =>
  successResponse(response, await adminPortal.unreadNotificationCount(request.scope));

export const markNotificationRead = async (request, response) =>
  successResponse(response, await adminPortal.markNotificationRead(request.params.id, request.scope, request.actor), {
    message: 'Notification marked as read',
  });

export const markAllNotificationsRead = async (request, response) =>
  successResponse(response, await adminPortal.markAllNotificationsRead(request.scope, request.actor), {
    message: 'Notifications marked as read',
  });
