import { ORDER_STATUS } from '@wolan/shared/constants';
import { successResponse } from '@wolan/shared/utils';
import { driverContext, portal } from './profile.controller.js';

export const listOrders = async (request, response) => {
  const result = await portal.listOrders(request.query, driverContext(request));
  return successResponse(response, result.items, { meta: result.meta });
};

export const availableOrders = async (request, response) => {
  const result = await portal.availableOrders(request.query, driverContext(request));
  return successResponse(response, result.items, { meta: result.meta });
};

export const getOrder = async (request, response) =>
  successResponse(response, await portal.getOrder(request.params.id, driverContext(request)));

export const accept = async (request, response) =>
  successResponse(response, await portal.accept(request.params.id, driverContext(request)));

export const reject = async (request, response) =>
  successResponse(response, await portal.reject(request.params.id, request.body.reason, driverContext(request)));

export const pickup = async (request, response) =>
  successResponse(response, await portal.transition(request.params.id, ORDER_STATUS.PICKED_UP, 'Package picked up', driverContext(request)));

export const atHub = async (request, response) =>
  successResponse(response, await portal.transition(request.params.id, ORDER_STATUS.AT_HUB, 'Package received at hub', driverContext(request)));

export const startDelivery = async (request, response) =>
  successResponse(response, await portal.transition(request.params.id, ORDER_STATUS.OUT_FOR_DELIVERY, 'Delivery started', driverContext(request)));

export const fail = async (request, response) =>
  successResponse(response, await portal.failDelivery(request.params.id, request.body, driverContext(request)), {
    message: 'Delivery failure recorded',
  });

export const returnOrder = async (request, response) =>
  successResponse(response, await portal.transition(request.params.id, ORDER_STATUS.RETURN_REQUESTED, request.body.note, driverContext(request)));

export const requestDeliveryOtp = async (request, response) =>
  successResponse(response, await portal.requestDeliveryOtp(request.params.id, driverContext(request)), {
    statusCode: 202,
    message: 'Delivery OTP queued for the customer',
  });

export const complete = async (request, response) =>
  successResponse(response, await portal.complete(request.params.id, request.body, driverContext(request)), {
    message: 'Delivery completed',
  });
