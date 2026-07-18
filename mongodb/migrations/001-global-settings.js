import { GLOBAL_HUB_ID, SYSTEM_ACTOR_ID } from '@wolan/shared/constants';
import { Setting } from '@wolan/shared/models';

export const id = '001-global-settings';

export async function up() {
  await Setting.updateOne(
    { hubId: GLOBAL_HUB_ID, key: 'platform.databaseName', deletedAt: null },
    {
      $setOnInsert: { hubId: GLOBAL_HUB_ID, key: 'platform.databaseName', value: 'wolan', description: 'Approved shared database name', createdBy: SYSTEM_ACTOR_ID, createdAt: new Date() },
      $set: { status: 'ACTIVE', updatedBy: SYSTEM_ACTOR_ID, updatedAt: new Date() },
    },
    { upsert: true, runValidators: true },
  );
}
