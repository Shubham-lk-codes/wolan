import { successResponse } from '@wolan/shared/utils';
import { merchantContext, portal } from './merchant.controller.js';

export const tracking = async (request, response) =>
  successResponse(response, await portal.tracking(request.params.id, merchantContext(request)));
