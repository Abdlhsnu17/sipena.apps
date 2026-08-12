import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';

export type DssAssetType = 'medical' | 'non_medical';

export interface DssAssetRow extends RowDataPacket {
  id: number;
  asset_code: string;
  name: string;
  category: string;
  type?: string | null;
  status?: string | null;
  condition?: string | null;
  location?: string | null;
  purchase_date?: string | Date | null;
  specifications?: string | Record<string, unknown> | null;
}

export interface DssCountRow extends RowDataPacket {
  asset_id: number;
  asset_type?: string | null;
  asset_detail_id?: string | null;
  asset_detail_code?: string | null;
  count: number;
}

export interface DssMaintenanceCountRow extends DssCountRow {
  total_cost?: number | null;
}

export interface DssWeightPreferenceRow extends RowDataPacket {
  user_id: number;
  weights_json: string;
  asset_type: string;
  updated_at: Date;
}

export interface DssRankingHistoryRow extends RowDataPacket {
  id: number;
  user_id: number | null;
  asset_type: string;
  label: string | null;
  weights_json: string;
  pairwise_matrix_json: string | null;
  criteria_json: string;
  total_alternatives: number;
  top_rankings_json: string | null;
  generated_at: Date;
  created_at: Date;
}

export interface DssLastHistorySnapshotRow extends RowDataPacket {
  asset_type: string;
  label: string | null;
  weights_json: string;
}

// Kolom disebut eksplisit (bukan SELECT *) agar kolom besar yang tidak dipakai
// SPK — deskripsi, image_url, harga, dan lain-lain — tidak ikut ditarik.
const MEDICAL_ASSET_COLUMNS = [
  'id',
  'asset_code',
  'name',
  'category',
  'status',
  '`condition`',
  'location',
  'purchase_date',
  'specifications',
].join(', ');

const NON_MEDICAL_ASSET_COLUMNS = MEDICAL_ASSET_COLUMNS;

export class DssRepository {
  async findAssets(assetType: DssAssetType | 'all'): Promise<DssAssetRow[]> {
    const medicalQuery = `SELECT ${MEDICAL_ASSET_COLUMNS}, 'medical' as type FROM medical_assets`;
    const nonMedicalQuery = `SELECT ${NON_MEDICAL_ASSET_COLUMNS}, 'non_medical' as type FROM non_medical_assets`;

    if (assetType === 'medical') {
      const [rows] = await pool.query<DssAssetRow[]>(medicalQuery);
      return rows;
    }
    if (assetType === 'non_medical') {
      const [rows] = await pool.query<DssAssetRow[]>(nonMedicalQuery);
      return rows;
    }

    const [medicalRows, nonMedicalRows] = await Promise.all([
      pool.query<DssAssetRow[]>(medicalQuery),
      pool.query<DssAssetRow[]>(nonMedicalQuery),
    ]);
    return [...medicalRows[0], ...nonMedicalRows[0]];
  }

  /**
   * Frekuensi pemakaian per detail inventaris.
   *
   * Memakai SUM(usage_count) dan mengabaikan baris yang sudah dihapus lunak,
   * supaya angkanya sama dengan hitungan ambang 10/25 di modul penggunaan aset.
   */
  async aggregateUsageCounts(): Promise<DssCountRow[]> {
    const [rows] = await pool.query<DssCountRow[]>(
      `SELECT asset_id, COALESCE(asset_type, 'medical') as asset_type, asset_detail_id, asset_detail_code,
              COALESCE(SUM(COALESCE(usage_count, 1)), 0) as count
       FROM asset_usage_logs
       WHERE deleted_at IS NULL
       GROUP BY asset_id, COALESCE(asset_type, 'medical'), asset_detail_id, asset_detail_code`
    );
    return rows;
  }

  async aggregateMaintenanceCounts(): Promise<DssMaintenanceCountRow[]> {
    const [rows] = await pool.query<DssMaintenanceCountRow[]>(
      `SELECT asset_id, COALESCE(asset_type, 'medical') as asset_type, asset_detail_id, asset_detail_code,
              COUNT(*) as count, COALESCE(SUM(cost), 0) as total_cost
       FROM maintenance_records
       WHERE status <> 'cancelled'
         AND deleted_at IS NULL
       GROUP BY asset_id, COALESCE(asset_type, 'medical'), asset_detail_id, asset_detail_code`
    );
    return rows;
  }

  async findWeightPreference(userId: number): Promise<DssWeightPreferenceRow | null> {
    const [rows] = await pool.query<DssWeightPreferenceRow[]>(
      `SELECT user_id, weights_json, asset_type, updated_at FROM dss_weight_preferences WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    return rows[0] ?? null;
  }

  async upsertWeightPreference(userId: number, weightsJson: string, assetType: string): Promise<void> {
    await pool.query(
      `INSERT INTO dss_weight_preferences (user_id, weights_json, asset_type)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE weights_json = VALUES(weights_json), asset_type = VALUES(asset_type)`,
      [userId, weightsJson, assetType]
    );
  }

  async findLastHistorySnapshot(userId: number | null): Promise<DssLastHistorySnapshotRow | null> {
    const [rows] = await pool.query<DssLastHistorySnapshotRow[]>(
      `SELECT asset_type, label, weights_json FROM dss_ranking_history
       WHERE user_id ${userId === null ? 'IS NULL' : '= ?'}
       ORDER BY created_at DESC LIMIT 1`,
      userId === null ? [] : [userId]
    );
    return rows[0] ?? null;
  }

  async insertRankingHistory(payload: {
    userId: number | null;
    assetType: string;
    label: string | null;
    weightsJson: string;
    pairwiseMatrixJson: string | null;
    criteriaJson: string;
    totalAlternatives: number;
    topRankingsJson: string;
    generatedAt: Date;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO dss_ranking_history (user_id, asset_type, label, weights_json, pairwise_matrix_json, criteria_json, total_alternatives, top_rankings_json, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.userId,
        payload.assetType,
        payload.label,
        payload.weightsJson,
        payload.pairwiseMatrixJson,
        payload.criteriaJson,
        payload.totalAlternatives,
        payload.topRankingsJson,
        payload.generatedAt,
      ]
    );
  }

  async findRankingHistory(userId: number, limit: number): Promise<DssRankingHistoryRow[]> {
    const [rows] = await pool.query<DssRankingHistoryRow[]>(
      `SELECT id, user_id, asset_type, label, weights_json, pairwise_matrix_json, criteria_json, total_alternatives, top_rankings_json, generated_at, created_at
       FROM dss_ranking_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
    return rows;
  }

  /** Satu entri riwayat milik pengguna; dipakai pembandingan skenario. */
  async findRankingHistoryById(userId: number, historyId: number): Promise<DssRankingHistoryRow | null> {
    const [rows] = await pool.query<DssRankingHistoryRow[]>(
      `SELECT id, user_id, asset_type, label, weights_json, pairwise_matrix_json, criteria_json, total_alternatives, top_rankings_json, generated_at, created_at
       FROM dss_ranking_history
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [historyId, userId]
    );
    return rows[0] ?? null;
  }

  async deleteRankingHistory(userId: number, historyId: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM dss_ranking_history WHERE id = ? AND user_id = ?`,
      [historyId, userId]
    );
    return result.affectedRows > 0;
  }
}

export const dssRepository = new DssRepository();
export default dssRepository;
