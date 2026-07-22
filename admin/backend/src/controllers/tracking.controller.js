import { successResponse } from '@wolan/shared/utils';
import { trackingService } from '../services/admin-services.js';

export const ingestTracking = async (request, response) =>
  successResponse(
    response,
    await trackingService.record(request.body, { hubId: request.body.hubId, actorId: null }),
    { statusCode: 202, message: 'Tracking sample accepted' },
  );
