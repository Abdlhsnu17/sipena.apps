import { RowDataPacket } from 'mysql2';
import { connectDatabase, disconnectDatabase } from '../config/database';
import pool from '../config/database';

// One-off cleanup for rows created before saveRankingHistory started skipping
// exact-duplicate snapshots (same user, asset type, and weights as the row
// immediately before it). Only collapses consecutive duplicates within a
// user's own history — distinct weight configurations are never touched.
const run = async (): Promise<void> => {
  await connectDatabase();

  try {
    const [rows] = await pool.query<(RowDataPacket & { id: number; user_id: number | null; asset_type: string; weights_json: string })[]>(
      `SELECT id, user_id, asset_type, weights_json FROM dss_ranking_history
       ORDER BY (user_id IS NULL), user_id ASC, created_at ASC, id ASC`
    );

    const idsToDelete: number[] = [];
    const lastKeptByUser = new Map<string, { asset_type: string; weights_json: string }>();

    rows.forEach((row) => {
      const userKey = row.user_id === null ? 'null' : String(row.user_id);
      const lastKept = lastKeptByUser.get(userKey);
      if (lastKept && lastKept.asset_type === row.asset_type && lastKept.weights_json === row.weights_json) {
        idsToDelete.push(row.id);
        return;
      }
      lastKeptByUser.set(userKey, { asset_type: row.asset_type, weights_json: row.weights_json });
    });

    console.log(`Total riwayat: ${rows.length}. Duplikat berurutan ditemukan: ${idsToDelete.length}.`);

    if (idsToDelete.length === 0) {
      console.log('Tidak ada yang perlu dihapus.');
      return;
    }

    const placeholders = idsToDelete.map(() => '?').join(', ');
    const [result] = await pool.query(
      `DELETE FROM dss_ranking_history WHERE id IN (${placeholders})`,
      idsToDelete
    );
    console.log(`Berhasil menghapus ${(result as { affectedRows: number }).affectedRows} baris riwayat duplikat.`);
  } finally {
    await disconnectDatabase();
  }
};

run().catch((error) => {
  console.error('Gagal membersihkan riwayat duplikat:', error);
  process.exit(1);
});
