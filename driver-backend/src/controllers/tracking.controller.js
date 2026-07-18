import { successResponse } from '@wolan/shared/utils';
import { driverContext, portal } from './profile.controller.js';

export const scanPackage = async (request, response) =>
  successResponse(response, await portal.scanPackage(request.params.id, request.body, driverContext(request)), {
    message: 'Package custody confirmed',
  });

export const updateLocation = async (request, response) =>
  successResponse(response, await portal.updateLocation(request.body, driverContext(request)), { statusCode: 202 });

export const heartbeat = async (request, response) =>
  successResponse(response, await portal.heartbeat(driverContext(request)));
