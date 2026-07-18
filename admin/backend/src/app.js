import compression from 'compression';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { errorHandler, notFound, requestContext, sanitizeRequest } from '@wolan/shared/middleware';
import { env } from './config/env.js';
import { adminRouter, publicRouter, trackingRouter } from './routes/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestContext);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ credentials: true, origin(origin, callback) { if (!origin || env.corsOrigins.includes(origin)) return callback(null, true); return callback(new Error('Origin not allowed by CORS')); } }));
  app.use(compression());
  app.use(express.json({ limit: '1mb', verify(request, _response, buffer) { request.rawBody = Buffer.from(buffer); } }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(sanitizeRequest);
  if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  app.get('/api/v1/public/health', (_request, response) => response.json({ success: true, data: { service: 'wolan-admin-api', status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', timestamp: new Date().toISOString() } }));
  app.use('/api/v1', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/public', publicRouter);
  app.use('/api/v1/tracking', trackingRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp();
