import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '@wolan/shared/utils';
import { env } from '../config/env.js';

cloudinary.config({ cloud_name: env.cloudinaryCloudName, api_key: env.cloudinaryApiKey, api_secret: env.cloudinaryApiSecret, secure: true });

export const cloudinaryUploadProvider = {
  upload(file, { folder }) {
    if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) throw new AppError('Upload provider is not configured', 503, 'UPLOAD_PROVIDER_UNAVAILABLE');
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'auto', use_filename: true, unique_filename: true }, (error, result) => {
        if (error) return reject(new AppError('Upload failed', 502, 'UPLOAD_FAILED'));
        return resolve({ publicId: result.public_id, url: result.secure_url, bytes: result.bytes, format: result.format, resourceType: result.resource_type, originalName: file.originalname });
      });
      stream.end(file.buffer);
    });
  },
};
