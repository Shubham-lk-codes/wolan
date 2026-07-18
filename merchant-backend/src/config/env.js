import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { DATABASE_NAME } from '@wolan/shared/constants';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') });
const required = (name) => { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required`); return value; };
const port = Number.parseInt(process.env.PORT ?? process.env.MERCHANT_PORT ?? '5001', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT or MERCHANT_PORT must be a valid port');
const nodeEnv = process.env.NODE_ENV ?? 'development';
const configuredDatabaseName = process.env.MONGODB_DB_NAME?.trim();
if (nodeEnv === 'production' && !configuredDatabaseName) throw new Error('MONGODB_DB_NAME is required in production');
const databaseName = configuredDatabaseName ?? DATABASE_NAME;
if (databaseName !== DATABASE_NAME) throw new Error(`MONGODB_DB_NAME must be ${DATABASE_NAME}`);

export const env = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port,
  mongoUri: required('MONGODB_URI'), mongoDbName: databaseName,
  jwtAccessSecret: required('JWT_ACCESS_SECRET'), jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m', jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  jwtIssuer: process.env.JWT_ISSUER ?? 'wolan-logistics', jwtAudience: process.env.JWT_AUDIENCE ?? 'wolan-platform',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean),
  redisUrl: process.env.REDIS_URL ?? '',
});
