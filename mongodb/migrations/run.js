import 'dotenv/config';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { DATABASE_NAME, GLOBAL_HUB_ID, SYSTEM_ACTOR_ID } from '@wolan/shared/constants';
import { Setting } from '@wolan/shared/models';

const uri = process.env.MONGODB_URI?.trim();
const databaseName = process.env.MONGODB_DB_NAME?.trim() || DATABASE_NAME;
if (!uri) throw new Error('MONGODB_URI is required');
if (databaseName !== DATABASE_NAME) throw new Error(`MONGODB_DB_NAME must be ${DATABASE_NAME}`);

const directory = path.dirname(fileURLToPath(import.meta.url));
const files = (await readdir(directory)).filter((name) => /^\d+.*\.js$/.test(name)).sort();
await mongoose.connect(uri, { dbName: databaseName, serverSelectionTimeoutMS: 10_000 });
try {
  for (const file of files) {
    const migration = await import(pathToFileURL(path.join(directory, file)));
    const key = `migration:${migration.id}`;
    const applied = await Setting.exists({ hubId: GLOBAL_HUB_ID, key, status: 'APPLIED', deletedAt: null });
    if (applied) { console.log(`Already applied: ${migration.id}`); continue; }
    await migration.up();
    await Setting.updateOne(
      { hubId: GLOBAL_HUB_ID, key, deletedAt: null },
      { $setOnInsert: { hubId: GLOBAL_HUB_ID, key, createdBy: SYSTEM_ACTOR_ID, createdAt: new Date() }, $set: { value: { file, appliedAt: new Date() }, status: 'APPLIED', updatedBy: SYSTEM_ACTOR_ID, updatedAt: new Date() } },
      { upsert: true, runValidators: true },
    );
    console.log(`Applied: ${migration.id}`);
  }
} finally {
  await mongoose.disconnect();
}
