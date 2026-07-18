import { successResponse } from '@wolan/shared/utils';
import { merchantContext, portal } from './merchant.controller.js';

export const finance = async (request, response) =>
  successResponse(response, await portal.finance(merchantContext(request)));

export const cod = async (request, response) =>
  successResponse(response, await portal.cod(merchantContext(request)));

export const payments = async (request, response) =>
  successResponse(response, await portal.payments(merchantContext(request)));

export const payouts = async (request, response) =>
  successResponse(response, await portal.payouts(merchantContext(request)));
