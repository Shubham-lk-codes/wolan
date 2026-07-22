import { successResponse } from '@wolan/shared/utils';
import { adminPortal } from '../services/admin-services.js';

export const listUsers = async (request, response) =>
  successResponse(response, await adminPortal.listUsers(request.scope, request.query));

export const createUser = async (request, response) =>
  successResponse(response, await adminPortal.createUser(request.body, request.actor), {
    statusCode: 201,
    message: 'User created',
  });

export const updateUser = async (request, response) =>
  successResponse(response, await adminPortal.updateUser(request.params.id, request.scope, request.body, request.actor), {
    message: 'User updated',
  });
