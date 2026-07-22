import { successResponse } from '@wolan/shared/utils';
import { adminPortal } from '../services/admin-services.js';

export const driverWorkspace = async (request, response) =>
  successResponse(response, await adminPortal.driverWorkspace(request.params.id, request.scope));

export const driverIdentityAvailability = async (request, response) =>
  successResponse(response, await adminPortal.driverIdentityAvailability(request.body));
