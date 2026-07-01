import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ApiResponse } from '../models';
import {
  CreateDeletionRequestDTO,
  DeletionRequest,
  DeletionTargetType,
  ReviewDeletionRequestDTO,
} from '../models/deletion_request.model';
import borrowingService from './borrowing.service';
import maintenanceService from './maintenance.service';
import userService from './user.service';

interface DeletionRequestRow extends RowDataPacket {
  id: number;
  request_code: string | null;
  target_type: DeletionTargetType;
  target_id: number;
  target_label: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_by: number;
  requester_name: string | null;
  requester_nip: string | null;
  reviewed_by: number | null;
  reviewer_name: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  approved_at: Date | null;
  rejected_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const BASE_SELECT = `
  SELECT dr.*,
         requester.name AS requester_name,
         requester.nip AS requester_nip,
         reviewer.name AS reviewer_name
  FROM deletion_requests dr
  LEFT JOIN users requester ON requester.id = dr.requested_by
  LEFT JOIN users reviewer ON reviewer.id = dr.reviewed_by
`;

const mapRow = (row: DeletionRequestRow): DeletionRequest => ({
  id: row.id,
  requestCode: row.request_code ?? undefined,
  targetType: row.target_type,
  targetId: row.target_id,
  targetLabel: row.target_label ?? undefined,
  reason: row.reason,
  status: row.status,
  requestedBy: row.requested_by,
  requesterName: row.requester_name ?? undefined,
  requesterNip: row.requester_nip ?? undefined,
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
  return `DEL/${yy}${mm}/${String(id).padStart(4, '0')}`;
};

const resolveTargetLabel = async (targetType: DeletionTargetType, targetId: number): Promise<string | undefined> => {
  if (targetType === 'user') {
    const result = await userService.getById(String(targetId));
    if (!result.success || !result.data) return undefined;
    return `${result.data.name} (${result.data.nip})`;
  }

  if (targetType === 'borrowing' || targetType === 'return') {
    const result = await borrowingService.getById(String(targetId));
    if (!result.success || !result.data) return undefined;
    return result.data.assetDetailName || result.data.assetName || result.data.borrowingCode || `#${targetId}`;
  }

  const result = await maintenanceService.getById(String(targetId));
  if (!result.success || !result.data) return undefined;
  return result.data.assetDetailName || result.data.assetName || result.data.maintenanceCode || `#${targetId}`;
};

const applyArchive = async (request: DeletionRequest, reviewedBy: number): Promise<ApiResponse> => {
  const reason = request.reason;
  if (request.targetType === 'user') {
    return userService.delete(String(request.targetId), reviewedBy, reason);
  }
  if (request.targetType === 'borrowing' || request.targetType === 'return') {
    return borrowingService.delete(String(request.targetId), reviewedBy, reason);
  }
  return maintenanceService.delete(String(request.targetId), reviewedBy, reason);
};

export class DeletionRequestService {
  async getAll(filters: {
    status?: string;
    targetType?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ data: DeletionRequest[]; total: number }>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.status) {
      conditions.push('dr.status = ?');
      params.push(filters.status);
    }
    if (filters.targetType) {
      conditions.push('dr.target_type = ?');
      params.push(filters.targetType);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [[countRow]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM deletion_requests dr ${where}`,
      params
    );
    const [rows] = await pool.query<DeletionRequestRow[]>(
      `${BASE_SELECT} ${where} ORDER BY dr.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      success: true,
      message: 'Data permintaan arsip berhasil diambil',
      data: { data: rows.map(mapRow), total: Number(countRow?.total ?? 0) },
    };
  }

  async getById(id: number): Promise<ApiResponse<DeletionRequest>> {
    const [rows] = await pool.query<DeletionRequestRow[]>(`${BASE_SELECT} WHERE dr.id = ? LIMIT 1`, [id]);
    if (!rows.length) return { success: false, message: 'Permintaan arsip tidak ditemukan' };
    return { success: true, message: 'OK', data: mapRow(rows[0]) };
  }

  async create(dto: CreateDeletionRequestDTO): Promise<ApiResponse<DeletionRequest>> {
    const label = dto.targetLabel?.trim() || await resolveTargetLabel(dto.targetType, dto.targetId);
    if (!label) return { success: false, message: 'Data yang diajukan tidak ditemukan' };

    const [existingRows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM deletion_requests
       WHERE target_type = ?
         AND target_id = ?
         AND status = 'pending'
       LIMIT 1`,
      [dto.targetType, dto.targetId]
    );
    if (existingRows.length > 0) {
      return { success: false, message: 'Permintaan arsip untuk data ini masih menunggu persetujuan' };
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO deletion_requests
         (target_type, target_id, target_label, reason, status, requested_by)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [dto.targetType, dto.targetId, label, dto.reason, dto.requestedBy]
    );
    const code = generateCode(result.insertId);
    await pool.query('UPDATE deletion_requests SET request_code = ? WHERE id = ?', [code, result.insertId]);
    return this.getById(result.insertId);
  }

  async approve(id: number, dto: ReviewDeletionRequestDTO): Promise<ApiResponse<DeletionRequest>> {
    const existing = await this.getById(id);
    if (!existing.success || !existing.data) return { success: false, message: 'Permintaan tidak ditemukan' };
    if (existing.data.status !== 'pending') return { success: false, message: 'Permintaan sudah diproses sebelumnya' };

    const archiveResult = await applyArchive(existing.data, dto.reviewedBy);
    if (!archiveResult.success) return { success: false, message: archiveResult.message || 'Gagal mengarsipkan data' };

    await pool.query(
      `UPDATE deletion_requests
       SET status = 'approved',
           reviewed_by = ?,
           reviewed_at = NOW(),
           review_notes = ?,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [dto.reviewedBy, dto.reviewNotes ?? null, id]
    );

    return this.getById(id);
  }

  async reject(id: number, dto: ReviewDeletionRequestDTO): Promise<ApiResponse<DeletionRequest>> {
    const existing = await this.getById(id);
    if (!existing.success || !existing.data) return { success: false, message: 'Permintaan tidak ditemukan' };
    if (existing.data.status !== 'pending') return { success: false, message: 'Permintaan sudah diproses sebelumnya' };

    await pool.query(
      `UPDATE deletion_requests
       SET status = 'rejected',
           reviewed_by = ?,
           reviewed_at = NOW(),
           review_notes = ?,
           rejected_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [dto.reviewedBy, dto.reviewNotes ?? null, id]
    );

    return this.getById(id);
  }
}

export default new DeletionRequestService();
