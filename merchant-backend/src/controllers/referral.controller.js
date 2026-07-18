import { successResponse } from '@wolan/shared/utils';
import { merchantContext, portal } from './merchant.controller.js';

export const referrals = async (request, response) =>
  successResponse(response, await portal.referrals(merchantContext(request)));
