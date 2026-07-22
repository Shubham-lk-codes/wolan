import { successResponse } from '@wolan/shared/utils';
import { uploadService } from '../services/admin-services.js';

export const uploadFiles = async (request, response) =>
  successResponse(response, await uploadService.upload(request.files, { folder: request.body.folder }), {
    statusCode: 201,
    message: 'Files uploaded',
  });
