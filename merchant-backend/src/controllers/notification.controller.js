import { successResponse } from '@wolan/shared/utils';
import { merchantContext, portal } from './merchant.controller.js';

export const notifications = async (request, response) =>
  successResponse(response, await portal.notifications(merchantContext(request)));

export const markNotificationRead = async (request, response) =>
  successResponse(response, await portal.markNotificationRead(request.params.id, merchantContext(request)));
