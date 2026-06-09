import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ApiResponse } from '../models';
import { AssetDisposalRequest, CreateDisposalRequestDTO, ReviewDisposalRequestDTO } from '../models/asset_disposal.model';
import { sendDisposalReviewedEmail } from './email.service';

interface DisposalRow extends RowDataPacket {
  id: number;
  request_code: string;
  asset_id: number;
  asset_type: string;
  asset_detail_id: string | null;
  asset_detail_name: string | null;
  asset_detail_code: string | null;
  reason: string;
  condition_notes: string | null;
  status: string;
  requested_by: number;
  requester_name: string;
  requester_nip: string;
  requester_email: string | null;
  reviewed_by: number | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

const mapRow = (row: DisposalRow): AssetDisposalRequest => ({
  id: row.id,
  requestCode: row.request_code,
  assetId: row.asset_id,
  assetType: row.asset_type as any,
  assetDetailId: row.asset_detail_id ?? undefined,
  assetDetailName: row.asset_detail_name ?? undefined,
  assetDetailCode: row.asset_detail_code ?? undefined,
  reason: row.reason,
  conditionNotes: row.condition_notes ?? undefined,
  status: row.status as any,
  requestedBy: row.requested_by,
  requesterName: row.requester_name,
  requesterNip: row.requester_nip,
  requesterEmail: row.requester_email ?? undefined,
  reviewedBy: row.reviewed_by ?? undefined,
  reviewerName: row.reviewer_name ?? undefined,
  reviewedAt: row.reviewed_at ?? undefined,
  reviewNotes: row.review_notes ?? undefined,
  approvedAt: row.approved_at ?? undefined,
  rejectedAt: row.rejected_at ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const generateCode = (id: number): string => {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `DISP/${yy}${mm}/${String(id).padStart(4, '0')}`;
};

const BASE_SELECT = `
  SELECT d.*,
         u.name  AS requester_name,
         u.nip   AS requester_nip,
         u.email AS requester_email,
         ru.name AS reviewer_name
  FROM asset_disposal_requests d
  LEFT JOIN users u  ON u.id = d.requested_by
  LEFT JOIN users ru ON ru.id = d.reviewed_by
`;

export class AssetDisposalService {
  async getAll(filters: {
    status?: string;
    assetType?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ data: AssetDisposalRequest[]; total: number }>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.status) {
      conditions.push('d.status = ?');
      params.push(filters.status);
    }
    if (filters.assetType) {
      conditions.push('d.asset_type = ?');
      params.push(filters.assetType);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[countRow]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM asset_disposal_requests d ${where}`,
      params
    );
    const total = Number(countRow?.total ?? 0);

    const [rows] = await pool.query<DisposalRow[]>(
      `${BASE_SELECT} ${where} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      success: true,
      message: 'Data permintaan penghapusan berhasil diambil',
      data: { data: rows.map(mapRow), total },
    };
  }

  async getById(id: number): Promise<ApiResponse<AssetDisposalRequest>> {
    const [rows] = await pool.query<DisposalRow[]>(`${BASE_SELECT} WHERE d.id = ? LIMIT 1`, [id]);
    if (!rows.length) return { success: false, message: 'Permintaan penghapusan tidak ditemukan' };
    return { success: true, message: 'OK', data: mapRow(rows[0]) };
  }

  async create(dto: CreateDisposalRequestDTO): Promise<ApiResponse<AssetDisposalRequest>> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO asset_disposal_requests
         (asset_id, asset_type, asset_detail_id, asset_detail_name, asset_detail_code, reason, condition_notes, status, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        dto.assetId,
        dto.assetType,
        dto.assetDetailId ?? null,
        dto.assetDetailName ?? null,
        dto.assetDetailCode ?? null,
        dto.reason,
        dto.conditionNotes ?? null,
        dto.requestedBy,
      ]
    );

    const code = generateCode(result.insertId);
    await pool.query('UPDATE asset_disposal_requests SET request_code = ? WHERE id = ?', [code, result.insertId]);

    return this.getById(result.insertId);
  }

  async approve(id: number, dto: ReviewDisposalRequestDTO): Promise<ApiResponse<AssetDisposalRequest>> {
    const existing = await this.getById(id);
    if (!existing.success || !existing.data) return { success: false, message: 'Permintaan tidak ditemukan' };
    if (existing.data.status !== 'pending') return { success: false, message: 'Permintaan sudah diproses sebelumnya' };

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `UPDATE asset_disposal_requests
         SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?, approved_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [dto.reviewedBy, dto.reviewNotes ?? null, id]
      );

      // Update asset status to disposed
      const { assetType, assetId } = existing.data;
      const table = assetType === 'medical' ? 'medical_assets' : 'non_medical_assets';
      await conn.query(`UPDATE ${table} SET status = 'disposed', updated_at = NOW() WHERE id = ?`, [assetId]);

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const result = await this.getById(id);

    // Send approval email (fire-and-forget)
    try {
      const d = result.data;
      if (d?.requesterEmail) {
        sendDisposalReviewedEmail(d.requesterEmail, {
          requesterName: d.requesterName ?? 'Pemohon',
          assetName: d.assetDetailName ?? String(d.assetId),
          requestCode: d.requestCode ?? String(id),
          approved: true,
          reviewNotes: d.reviewNotes,
        }).catch(() => {});
      }
    } catch {
      // email errors never block
    }

    return result;
  }

  async reject(id: number, dto: ReviewDisposalRequestDTO): Promise<ApiResponse<AssetDisposalRequest>> {
    const existing = await this.getById(id);
    if (!existing.success || !existing.data) return { success: false, message: 'Permintaan tidak ditemukan' };
    if (existing.data.status !== 'pending') return { success: false, message: 'Permintaan sudah diproses sebelumnya' };

    await pool.query(
      `UPDATE asset_disposal_requests
       SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?, rejected_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [dto.reviewedBy, dto.reviewNotes ?? null, id]
    );

    const result = await this.getById(id);

    // Send rejection email (fire-and-forget)
    try {
      const d = result.data;
      if (d?.requesterEmail) {
        sendDisposalReviewedEmail(d.requesterEmail, {
          requesterName: d.requesterName ?? 'Pemohon',
          assetName: d.assetDetailName ?? String(d.assetId),
          requestCode: d.requestCode ?? String(id),
          approved: false,
          reviewNotes: d.reviewNotes,
        }).catch(() => {});
      }
    } catch {
      // email errors never block
    }

    return result;
  }

  async delete(id: number): Promise<ApiResponse<null>> {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM asset_disposal_requests WHERE id = ? AND status = ?',
      [id, 'pending']
    );
    if (result.affectedRows === 0) {
      return { success: false, message: 'Permintaan tidak ditemukan atau sudah diproses' };
    }
    return { success: true, message: 'Permintaan penghapusan dibatalkan', data: null };
  }
}

export default new AssetDisposalService();
