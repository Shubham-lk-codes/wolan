import { successResponse } from '@wolan/shared/utils';
import { orderService } from '../services/admin-services.js';

export const listOrders = async (request, response) =>
  successResponse(response, await orderService.list(request.scope, request.query));

export const getOrder = async (request, response) =>
  successResponse(response, await orderService.get(request.params.id, request.scope));

export const createOrder = async (request, response) =>
  successResponse(response, await orderService.create(request.body, request.actor), {
    statusCode: 201,
    message: 'Order created',
  });

export const quoteOrder = async (request, response) =>
  successResponse(response, orderService.quote(request.body));

export const verifyPickup = async (request, response) =>
  successResponse(response, await orderService.verifyPickup(request.params.id, request.body.key, request.scope, request.actor), {
    message: 'Merchant handover verified',
  });

export const scanAtHub = async (request, response) =>
  successResponse(response, await orderService.scanAtHub(request.params.id, request.body.code, request.scope, request.actor), {
    message: 'Package scanned into hub',
  });

export const assignOrder = async (request, response) =>
  successResponse(response, await orderService.assign(request.params.id, request.body.driverId, request.scope, request.actor), {
    message: 'Driver assigned',
  });

export const transitionOrder = async (request, response) =>
  successResponse(response, await orderService.transition(
    request.params.id,
    request.body.status,
    request.scope,
    request.actor,
    request.body.note,
  ));
