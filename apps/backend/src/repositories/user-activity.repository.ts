import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';

export interface UserActivityRow extends RowDataPacket {
  id: number;
  user_id: number;
  user_name?: string | null;
  user_nip?: string | null;
  feature: string;
  action: string;
  description: string;
  metadata_json: string | null;
  created_at: Date;
}

export interface BorrowingRecordInfoRow extends RowDataPacket {
  borrowing_code: string | null;
  asset_name: string | null;
  asset_code: string | null;
}

export interface MaintenanceRecordInfoRow extends RowDataPacket {
  maintenance_code: string | null;
  asset_name: string | null;
  asset_code: string | null;
}

export interface TotalRow extends RowDataPacket {
  total: number;
}

export interface ActivityWhereClause {
  clause: string;
  params: Array<string | number>;
}

export class UserActivityRepository {
  async create(payload: {
    userId: number;
    feature: string;
    action: string;
    description: string;
    metadataJson: string | null;
  }): Promise<ResultSetHeader> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO user_activity_logs (user_id, feature, action, description, metadata_json)
       VALUES (?, ?, ?, ?, ?)`,
      [payload.userId, payload.feature, payload.action, payload.description, payload.metadataJson]
    );

    return result;
  }

  async findRecentByUserId(userId: number, limit: number): Promise<UserActivityRow[]> {
    const [rows] = await pool.query<UserActivityRow[]>(
      `SELECT ual.id, ual.user_id, u.name AS user_name, u.nip AS user_nip, ual.feature, ual.action, ual.description, ual.metadata_json, ual.created_at
       FROM user_activity_logs ual
       LEFT JOIN users u ON u.id = ual.user_id
       WHERE ual.user_id = ?
         AND NOT (feature = 'pencarian' AND action = 'search')
       ORDER BY ual.created_at DESC
       LIMIT ?`,
      [userId, limit]
    );

    return rows;
  }

  async countActivities(where: ActivityWhereClause): Promise<number> {
    const [rows] = await pool.query<TotalRow[]>(
      `SELECT COUNT(*) AS total
       FROM user_activity_logs ual
       ${where.clause}`,
      where.params
    );

    return Number(rows[0]?.total || 0);
  }

  async findActivities(where: ActivityWhereClause, limit: number, offset: number): Promise<UserActivityRow[]> {
    const [rows] = await pool.query<UserActivityRow[]>(
      `SELECT ual.id, ual.user_id, u.name AS user_name, u.nip AS user_nip,
              ual.feature, ual.action, ual.description, ual.metadata_json, ual.created_at
       FROM user_activity_logs ual
       LEFT JOIN users u ON u.id = ual.user_id
       ${where.clause}
       ORDER BY ual.created_at DESC
       LIMIT ? OFFSET ?`,
      [...where.params, limit, offset]
    );

    return rows;
  }

  async findBorrowingRecordInfo(borrowingId: number): Promise<BorrowingRecordInfoRow | null> {
    const [rows] = await pool.query<BorrowingRecordInfoRow[]>(
      `SELECT
         br.borrowing_code,
         COALESCE(br.asset_detail_name, ma.name, na.name) AS asset_name,
         COALESCE(br.asset_detail_code, ma.asset_code, na.asset_code) AS asset_code
       FROM borrowing_records br
       LEFT JOIN medical_assets ma
         ON (br.asset_type = 'medical' OR br.asset_type IS NULL) AND br.asset_id = ma.id
       LEFT JOIN non_medical_assets na
         ON br.asset_type = 'non_medical' AND br.asset_id = na.id
       WHERE br.id = ?
       LIMIT 1`,
      [borrowingId]
    );

    return rows[0] ?? null;
  }

  async findMaintenanceRecordInfoByMaintenanceId(maintenanceId: number): Promise<MaintenanceRecordInfoRow | null> {
    const [rows] = await pool.query<MaintenanceRecordInfoRow[]>(
      `SELECT
         mr.maintenance_code,
         COALESCE(mr.asset_detail_name, ma.name, na.name) AS asset_name,
         COALESCE(mr.asset_detail_code, ma.asset_code, na.asset_code) AS asset_code
       FROM maintenance_records mr
       LEFT JOIN medical_assets ma
         ON (mr.asset_type = 'medical' OR mr.asset_type IS NULL) AND mr.asset_id = ma.id
       LEFT JOIN non_medical_assets na
         ON mr.asset_type = 'non_medical' AND mr.asset_id = na.id
       WHERE mr.id = ?
       LIMIT 1`,
      [maintenanceId]
    );

    return rows[0] ?? null;
  }
}

export const userActivityRepository = new UserActivityRepository();
