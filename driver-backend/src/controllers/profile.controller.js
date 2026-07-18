import { DriverPortalService } from '@wolan/shared/services';
import { successResponse } from '@wolan/shared/utils';

export const portal = new DriverPortalService({
  eventPublisher: async (event, payload) => globalThis.wolanDriverPublisher?.(event, payload),
});

export const driverContext = (request) => ({
  user: request.user,
  scope: request.scope,
  actor: request.actor,
  requestId: request.id,
});

export const profile = async (request, response) =>
  successResponse(response, await portal.profile(driverContext(request)));

export const updateProfile = async (request, response) =>
  successResponse(response, await portal.updateProfile(request.body, driverContext(request)));

export const dashboard = async (request, response) =>
  successResponse(response, await portal.dashboard(driverContext(request)));
