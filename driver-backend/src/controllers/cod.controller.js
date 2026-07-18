import { successResponse } from '@wolan/shared/utils';
import { driverContext, portal } from './profile.controller.js';

export const cod = async (request, response) =>
  successResponse(response, await portal.codSummary(driverContext(request)));
