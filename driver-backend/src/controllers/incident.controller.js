import { successResponse } from '@wolan/shared/utils';
import { driverContext, portal } from './profile.controller.js';

export const reportIncident = async (request, response) =>
  successResponse(response, await portal.reportIncident(request.body, driverContext(request)), {
    statusCode: 201,
    message: 'Incident reported',
  });
