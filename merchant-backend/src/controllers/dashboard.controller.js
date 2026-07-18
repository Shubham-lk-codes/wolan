import { successResponse } from '@wolan/shared/utils';
import { merchantContext, portal } from './merchant.controller.js';

export const dashboard = async (request, response) =>
  successResponse(response, await portal.dashboard(merchantContext(request)));
