import { successResponse } from '@wolan/shared/utils';
import { adminPortal } from '../services/admin-services.js';

export const saveSettings = async (request, response) =>
  successResponse(response, await adminPortal.saveSettings(request.body, request.actor), {
    message: 'Settings saved',
  });
