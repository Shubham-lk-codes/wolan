import { successResponse } from '@wolan/shared/utils';
import { merchantContext, portal } from './merchant.controller.js';

export const listOrders = async (request, response) => {
  const result = await portal.listOrders(request.query, merchantContext(request));
  return successResponse(response, result.items, { meta: result.meta });
};

export const createOrder = async (request, response) =>
  successResponse(response, await portal.createOrder(request.body, merchantContext(request)), {
    statusCode: 201,
    message: 'Order created',
  });

export const getOrder = async (request, response) =>
  successResponse(response, await portal.getOrder(request.params.id, merchantContext(request)));

export const sendOff = async (request, response) =>
  successResponse(response, await portal.sendOff(request.params.id, merchantContext(request)), {
    message: 'Package marked ready for pickup',
  });

export const cancelOrder = async (request, response) =>
  successResponse(response, await portal.cancel(request.params.id, request.body.reason, merchantContext(request)));
