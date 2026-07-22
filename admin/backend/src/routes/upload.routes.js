import { Router } from 'express';
import multer from 'multer';
import { authorize } from '@wolan/shared/middleware';
import { AppError } from '@wolan/shared/utils';
import * as controller from '../controllers/upload.controller.js';
import { route } from './route.utils.js';

const allowedUploads = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (_request, file, callback) => {
    const allowed = allowedUploads.has(file.mimetype);
    callback(allowed ? null : new AppError(`Unsupported file type: ${file.mimetype}`, 422, 'UPLOAD_TYPE_NOT_ALLOWED'), allowed);
  },
});

export const uploadRoutes = Router();

uploadRoutes.post('/upload', authorize('upload:create', 'upload:*'), upload.array('files', 10), route(controller.uploadFiles));
