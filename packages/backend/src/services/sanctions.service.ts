import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import { ApiResponse } from '../models';

export interface SanctionRecord {
  id: number;
  borrowingCode?: string;
  userId: number;
  userName: string;
  userNip: string;
  assetName: string;
  assetCode?: string;
  borrowDate?: string;
  dueDate?: string;
  returnDate?: string;
  overdueDays: number;
  sanctionStatus: 'none' | 'active' | 'resolved';
  sanctionNotes?: string;
  sanctionAppliedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedByUserId?: number;
  resolvedNotes?: string;
}

export interface SanctionFilters {
  status?: 'active' | 'resolved' | 'all';
  userId?: number;
  page?: number;
  limit?: number;
}

interface SanctionRow extends RowDataPacket {
  id: number;
  borrowing_code: string;
  user_id: number;
  user_name: string;
  user_nip: string;
  asset_name: string;
  asset_code: string;
  borrow_date: string;
  due_date: string;
  return_date: string | null;
  overdue_days: number;
  sanction_status: string;
  sanction_notes: string | null;
  sanction_applied_at: string | null;
  resolved_at: string | null;
  resolved_by_name: string | null;
  resolved_by_user_id: number | null;
  resolved_notes: string | null;
}

const mapRow = (row: SanctionRow): SanctionRecord => ({
  id: row.id,
  borrowingCode: row.borrowing_code,
  userId: row.user_id,
  userName: row.user_name,
  userNip: row.user_nip,
  assetName: row.asset_name,
  assetCode: row.asset_code,
  borrowDate: row.borrow_date,
  dueDate: row.due_date,
  returnDate: row.return_date ?? undefined,
  overdueDays: row.overdue_days ?? 0,
  sanctionStatus: (row.sanction_status as any) ?? 'none',
  sanctionNotes: row.sanction_notes ?? undefined,
  sanctionAppliedAt: row.sanction_applied_at ?? undefined,
  resolvedAt: row.resolved_at ?? undefined,
  resolvedBy: row.resolved_by_name ?? undefined,
  resolvedByUserId: row.resolved_by_user_id ?? undefined,
  resolvedNotes: row.resolved_notes ?? undefined,
});

export class SanctionsService {
  async getAll(filters: SanctionFilters): Promise<ApiResponse<{ data: SanctionRecord[]; total: number }>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;
    const status = filters.status ?? 'active';

    const conditions: string[] = ["br.sanction_status != 'none'"];
    const params: any[] = [];

    if (status !== 'all') {
      conditions.push('br.sanction_status = ?');
      params.push(status);
    }

    if (filters.userId) {
      conditions.push('br.user_id = ?');
      params.push(filters.userId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[countRow]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM borrowing_records br ${where}`,
      params
    );
    const total = Number(countRow?.total ?? 0);

    const [rows] = await pool.query<SanctionRow[]>(
      `SELECT
         br.id,
         br.borrowing_code,
         br.user_id,
         u.name AS user_name,
         u.nip  AS user_nip,
         COALESCE(br.asset_detail_name, br.asset_id) AS asset_name,
         br.asset_detail_code AS asset_code,
         br.borrow_date,
         br.due_date,
         br.return_date,
         br.overdue_days,
         br.sanction_status,
         br.sanction_notes,
         br.sanction_applied_at,
         br.resolved_at,
         ru.name AS resolved_by_name,
         br.resolved_by_user_id,
         br.resolved_notes
       FROM borrowing_records br
       LEFT JOIN users u ON u.id = br.user_id
       LEFT JOIN users ru ON ru.id = br.resolved_by_user_id
       ${where}
       ORDER BY br.sanction_applied_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      success: true,
      message: 'Data sanksi berhasil diambil',
      data: { data: rows.map(mapRow), total },
    };
  }

  async resolve(
    borrowingId: number,
    resolvedByUserId: number,
    resolvedNotes?: string
  ): Promise<ApiResponse<SanctionRecord>> {
    const [[existing]] = await pool.query<RowDataPacket[]>(
      `SELECT id, sanction_status FROM borrowing_records WHERE id = ? LIMIT 1`,
      [borrowingId]
    );

    if (!existing) {
      return { success: false, message: 'Data peminjaman tidak ditemukan' };
    }
    if (existing.sanction_status !== 'active') {
      return { success: false, message: 'Sanksi tidak aktif atau sudah diselesaikan' };
    }

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE borrowing_records
       SET sanction_status = 'resolved',
           resolved_at = NOW(),
           resolved_by_user_id = ?,
           resolved_notes = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [resolvedByUserId, resolvedNotes ?? null, borrowingId]
    );

    if (result.affectedRows === 0) {
      return { success: false, message: 'Gagal menyelesaikan sanksi' };
    }

    const [[updated]] = await pool.query<SanctionRow[]>(
      `SELECT br.*, u.name AS user_name, u.nip AS user_nip,
              COALESCE(br.asset_detail_name, br.asset_id) AS asset_name,
              br.asset_detail_code AS asset_code,
              ru.name AS resolved_by_name
       FROM borrowing_records br
       LEFT JOIN users u ON u.id = br.user_id
       LEFT JOIN users ru ON ru.id = br.resolved_by_user_id
       WHERE br.id = ?`,
      [borrowingId]
    );

    return { success: true, message: 'Sanksi berhasil diselesaikan', data: mapRow(updated) };
  }

  async waive(
    borrowingId: number,
    resolvedByUserId: number,
    reason: string
  ): Promise<ApiResponse<SanctionRecord>> {
    const [[existing]] = await pool.query<RowDataPacket[]>(
      `SELECT id, sanction_status FROM borrowing_records WHERE id = ? LIMIT 1`,
      [borrowingId]
    );

    if (!existing) {
      return { success: false, message: 'Data peminjaman tidak ditemukan' };
    }
    if (existing.sanction_status !== 'active') {
      return { success: false, message: 'Sanksi tidak aktif atau sudah diselesaikan' };
    }

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE borrowing_records
       SET sanction_status = 'resolved',
           resolved_at = NOW(),
           resolved_by_user_id = ?,
           resolved_notes = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [resolvedByUserId, `[DIBEBASKAN] ${reason}`, borrowingId]
    );

    if (result.affectedRows === 0) {
      return { success: false, message: 'Gagal membebaskan sanksi' };
    }

    const [[updated]] = await pool.query<SanctionRow[]>(
      `SELECT br.*, u.name AS user_name, u.nip AS user_nip,
              COALESCE(br.asset_detail_name, br.asset_id) AS asset_name,
              br.asset_detail_code AS asset_code,
              ru.name AS resolved_by_name
       FROM borrowing_records br
       LEFT JOIN users u ON u.id = br.user_id
       LEFT JOIN users ru ON ru.id = br.resolved_by_user_id
       WHERE br.id = ?`,
      [borrowingId]
    );

    return { success: true, message: 'Sanksi berhasil dibebaskan', data: mapRow(updated) };
  }

  async getStats(): Promise<ApiResponse<{ active: number; resolved: number; totalAffectedUsers: number }>> {
    const [[row]] = await pool.query<RowDataPacket[]>(
      `SELECT
         SUM(sanction_status = 'active')   AS active,
         SUM(sanction_status = 'resolved') AS resolved,
         COUNT(DISTINCT CASE WHEN sanction_status = 'active' THEN user_id END) AS total_affected_users
       FROM borrowing_records
       WHERE sanction_status != 'none'`
    );

    return {
      success: true,
      message: 'Statistik sanksi berhasil diambil',
      data: {
        active: Number(row?.active ?? 0),
        resolved: Number(row?.resolved ?? 0),
        totalAffectedUsers: Number(row?.total_affected_users ?? 0),
      },
    };
  }
}

export default new SanctionsService();
