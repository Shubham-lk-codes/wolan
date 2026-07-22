import { successResponse } from '@wolan/shared/utils';
import { adminPortal } from '../services/admin-services.js';

export const dashboard = async (request, response) =>
  successResponse(response, await adminPortal.dashboard(request.scope));
