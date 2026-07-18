import { successResponse } from '@wolan/shared/utils';
import { driverContext, portal } from './profile.controller.js';

export const earnings = async (request, response) =>
  successResponse(response, await portal.earnings(driverContext(request)));
