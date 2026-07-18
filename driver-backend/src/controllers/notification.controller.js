import { successResponse } from '@wolan/shared/utils';
import { driverContext, portal } from './profile.controller.js';

export const notifications = async (request, response) =>
  successResponse(response, await portal.notifications(driverContext(request)));

export const markNotificationRead = async (request, response) =>
  successResponse(response, await portal.markNotificationRead(request.params.id, driverContext(request)));
