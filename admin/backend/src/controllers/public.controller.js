import { successResponse } from '@wolan/shared/utils';
import { publicPortal } from '../services/admin-services.js';

export const publicTrack = async (request, response) =>
  successResponse(response, await publicPortal.track(request.params.token));

export const submitRating = async (request, response) =>
  successResponse(response, await publicPortal.submitRating(request.body), {
    statusCode: 201,
    message: 'Rating submitted',
  });
