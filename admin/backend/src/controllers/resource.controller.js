import { successResponse } from '@wolan/shared/utils';
import { adminPortal } from '../services/admin-services.js';

export const resourceList = (name) => async (request, response) =>
  successResponse(response, await adminPortal.listResource(name, request.scope, request.query));

export const merchantSummary = async (request, response) =>
  successResponse(response, await adminPortal.merchantSummary(request.scope));

export const resourceGet = (name) => async (request, response) =>
  successResponse(response, await adminPortal.getResource(name, request.params.id, request.scope));

export const resourceCreate = (name) => async (request, response) =>
  successResponse(response, await adminPortal.createResource(name, request.body, request.actor), {
    statusCode: 201,
    message: 'Created',
  });

export const resourceUpdate = (name) => async (request, response) =>
  successResponse(response, await adminPortal.updateResource(name, request.params.id, request.scope, request.body, request.actor));

export const resourceDelete = (name) => async (request, response) =>
  successResponse(response, await adminPortal.deleteResource(name, request.params.id, request.scope, request.actor), {
    message: 'Deleted',
  });
