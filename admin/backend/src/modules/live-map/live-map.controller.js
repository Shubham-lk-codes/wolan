import { successResponse } from '@wolan/shared/utils';
import { LiveMapService } from './live-map.service.js';

const liveMap = new LiveMapService();

export async function getLiveMap(request, response) {
  return successResponse(response, await liveMap.snapshot(request.scope, request.user));
}
