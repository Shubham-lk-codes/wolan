import 'dotenv/config';
import mongoose from 'mongoose';
import { AuthService } from '@wolan/shared/services';
import { DATABASE_NAME, ROLES, SYSTEM_ACTOR_ID } from '@wolan/shared/constants';
import { Hub, User } from '@wolan/shared/models';

const uri = process.env.MONGODB_URI?.trim();
const databaseName = process.env.MONGODB_DB_NAME?.trim() || DATABASE_NAME;
const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
if (!uri) throw new Error('MONGODB_URI is required');
if (databaseName !== DATABASE_NAME) throw new Error(`MONGODB_DB_NAME must be ${DATABASE_NAME}`);
if (!email || !password || password.length < 12) throw new Error('SEED_ADMIN_EMAIL and a 12+ character SEED_ADMIN_PASSWORD are required');

await mongoose.connect(uri, { dbName: databaseName, serverSelectionTimeoutMS: 10_000 });
try {
  const hub = await Hub.findOneAndUpdate(
    { code: 'HUB_001' },
    { $setOnInsert: { hubId: 'HUB_001', code: 'HUB_001', name: 'Kampala Central Hub', slug: 'kampala-central', city: 'Kampala', region: 'Central', status: 'ACTIVE', createdBy: SYSTEM_ACTOR_ID }, $set: { updatedBy: SYSTEM_ACTOR_ID } },
    { upsert: true, new: true, runValidators: true },
  );
  await User.updateOne(
    { email },
    { $setOnInsert: { hubId: hub.hubId, name: 'Wolan Super Admin', email, role: ROLES.SUPER_ADMIN, createdBy: SYSTEM_ACTOR_ID }, $set: { passwordHash: await AuthService.hashPassword(password), status: 'ACTIVE', updatedBy: SYSTEM_ACTOR_ID } },
    { upsert: true, runValidators: true },
  );
  console.log(`Development seed ready for ${email}`);
} finally {
  await mongoose.disconnect();
}
