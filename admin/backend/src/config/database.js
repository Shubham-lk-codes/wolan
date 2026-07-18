import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  // HTTP input is recursively sanitized and schema-validated before services
  // build their filters. Enabling Mongoose's global sanitizer here would wrap
  // trusted application operators such as $lte/$in in $eq and break casting.
  mongoose.set('sanitizeFilter', false);
  await mongoose.connect(env.mongoUri, {
    dbName: env.mongoDbName,
    maxPoolSize: 50,
    minPoolSize: env.isProduction ? 5 : 0,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    retryWrites: true,
  });
  if (mongoose.connection.name !== env.mongoDbName) throw new Error(`Connected to unexpected database ${mongoose.connection.name}`);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
