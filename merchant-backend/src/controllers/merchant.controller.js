import { MerchantPortalService } from '@wolan/shared/services';
import { successResponse } from '@wolan/shared/utils';

export const portal = new MerchantPortalService({
  eventPublisher: async (event, payload) => globalThis.wolanMerchantPublisher?.(event, payload),
});

export const merchantContext = (request) => ({
  user: request.user,
  scope: request.scope,
  actor: request.actor,
});

export const profile = async (request, response) =>
  successResponse(response, await portal.profile(merchantContext(request)));

export const updateProfile = async (request, response) =>
  successResponse(response, await portal.updateProfile(request.body, merchantContext(request)));
