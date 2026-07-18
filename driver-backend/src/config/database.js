import mongoose from 'mongoose'; import { env } from './env.js';
export async function connectDatabase() { await mongoose.connect(env.mongoUri, { dbName: env.mongoDbName, maxPoolSize: 30, serverSelectionTimeoutMS: 10_000, retryWrites: true }); if (mongoose.connection.name !== env.mongoDbName) throw new Error(`Connected to unexpected database ${mongoose.connection.name}`); }
export async function disconnectDatabase() { if (mongoose.connection.readyState) await mongoose.disconnect(); }
