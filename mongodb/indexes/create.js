import 'dotenv/config';
import mongoose from 'mongoose';
import { DATABASE_NAME } from '@wolan/shared/constants';
import { SHARED_MODELS } from '@wolan/shared/models';

const uri = process.env.MONGODB_URI?.trim();
const databaseName = process.env.MONGODB_DB_NAME?.trim() || DATABASE_NAME;
if (!uri) throw new Error('MONGODB_URI is required');
if (databaseName !== DATABASE_NAME) throw new Error(`MONGODB_DB_NAME must be ${DATABASE_NAME}`);

await mongoose.connect(uri, { dbName: databaseName, serverSelectionTimeoutMS: 10_000 });
try {
  const models = [...new Set(Object.values(SHARED_MODELS))];
  for (const model of models) {
    await model.createIndexes();
    console.log(`Indexes verified: ${model.collection.collectionName}`);
  }
} finally {
  await mongoose.disconnect();
}
