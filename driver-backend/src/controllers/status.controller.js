import { successResponse } from '@wolan/shared/utils';
import { driverContext, portal } from './profile.controller.js';

export const updateStatus = async (request, response) =>
  successResponse(response, await portal.updateStatus(request.body.status, driverContext(request)));
