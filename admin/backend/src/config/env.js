import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { DATABASE_NAME } from '@wolan/shared/constants';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../.env') });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const integer = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${name} must be a valid port`);
  return value;
};

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isTest = nodeEnv === 'test';
const mongoUri = isTest && process.env.MONGODB_URI ? process.env.MONGODB_URI : required('MONGODB_URI');
const configuredDatabaseName = process.env.MONGODB_DB_NAME?.trim();
if (nodeEnv === 'production' && !configuredDatabaseName) throw new Error('MONGODB_DB_NAME is required in production');
const mongoDbName = configuredDatabaseName ?? DATABASE_NAME;
if (mongoDbName !== DATABASE_NAME) throw new Error(`MONGODB_DB_NAME must be ${DATABASE_NAME}`);

export const env = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest,
  port: integer('ADMIN_PORT', 5000),
  mongoUri,
  mongoDbName,
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  jwtIssuer: process.env.JWT_ISSUER ?? 'wolan-logistics',
  jwtAudience: process.env.JWT_AUDIENCE ?? 'wolan-platform',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean),
  redisUrl: process.env.REDIS_URL ?? '',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  trackingWebhookSecret: required('TRACKING_WEBHOOK_SECRET'),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
});
