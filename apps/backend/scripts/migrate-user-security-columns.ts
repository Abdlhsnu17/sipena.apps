import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { ensureUserProfileColumns, withSchemaLock } from '../src/utils/schema';

const run = async (): Promise<void> => {
  await connectDatabase();

  try {
    await withSchemaLock(async () => {
      await ensureUserProfileColumns();
    });

    console.log('✅ Kolom users.phone_number dan users.session_version sudah diverifikasi/migrasi.');
  } finally {
    await disconnectDatabase();
  }
};

run().catch((error) => {
  console.error('❌ Gagal menjalankan migrasi user security columns:', error);
  process.exit(1);
});
