import { successResponse } from '@wolan/shared/utils';
import { hubManagerService } from '../services/hub-manager.service.js';

export const dashboard = async (request, response) =>
  successResponse(response, await hubManagerService.dashboard(request.scope));

export const context = async (request, response) =>
  successResponse(response, await hubManagerService.context(request.scope));

export const settings = async (request, response) =>
  successResponse(response, await hubManagerService.settings(request.scope));

export const updateSettings = async (request, response) =>
  successResponse(response, await hubManagerService.updateSettings(request.body, request.actor), {
    message: 'Hub settings saved',
  });
