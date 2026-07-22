import { successResponse } from '@wolan/shared/utils';
import { adminPortal } from '../services/admin-services.js';

export const reportOverview = async (request, response) =>
  successResponse(response, await adminPortal.reportOverview(request.scope, request.query));

export async function exportReport(request, response) {
  const csv = await adminPortal.exportOrdersCsv(request.scope, request.query);
  response.set('content-type', 'text/csv; charset=utf-8');
  response.set('content-disposition', `attachment; filename="wolan-${request.query.period.toLowerCase()}-report-${new Date().toISOString().slice(0, 10)}.csv"`);
  return response.send(csv);
}
