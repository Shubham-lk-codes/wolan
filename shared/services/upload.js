import { AppError } from '../utils/index.js';

export class UploadService {
  constructor(provider) {
    if (!provider?.upload) throw new Error('An upload provider is required');
    this.provider = provider;
  }

  async upload(files, { folder = 'uploads' } = {}) {
    if (!files?.length) throw new AppError('At least one file is required', 422, 'UPLOAD_REQUIRED');
    if (!/^[a-z0-9/_-]{1,100}$/i.test(folder) || folder.includes('..')) throw new AppError('Invalid upload folder', 422, 'INVALID_UPLOAD_FOLDER');
    return Promise.all(files.map((file) => this.provider.upload(file, { folder: `wolan/${folder}` })));
  }
}
