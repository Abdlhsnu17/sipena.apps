import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import {
    ApiResponse,
    Borrowing,
    BorrowingFilters,
    CreateBorrowingDTO,
    PaginatedResponse,
    ReturnBorrowingDTO,
    UpdateBorrowingDTO
} from '../models';
import { generateBorrowingCode } from '../utils/helpers';
import { AssetService } from './asset.service';

// Interface untuk hasil query gabungan
interface BorrowingRow extends RowDataPacket, Borrowing {
  asset_name: string;
  asset_code: string;
  asset_location: string;
  asset_image?: string; // Opsional jika ada
  returned_by_name?: string;
  returned_by_nip?: string;
}

interface CountRow extends RowDataPacket {
  count: number;
}

export class BorrowingService {
  private assetService: AssetService;

  constructor() {
    this.assetService = new AssetService();
  }

  async getAll(filters: BorrowingFilters): Promise<PaginatedResponse<Borrowing>> {
    const { page, limit, status, userId, assetId, assetType } = filters;
    const offset = (page - 1) * limit;

    // Perbaikan QUERY: Menggunakan logika JOIN yang lebih ketat terhadap asset_type
    // dan mengambil data dari tabel yang sesuai (medical vs non-medical)
    let query = `
      SELECT b.*,
        COALESCE(ma.name, na.name) as asset_name,
        COALESCE(ma.asset_code, na.asset_code) as asset_code,
        COALESCE(ma.location, na.location) as asset_location,
        COALESCE(b.asset_type, 'medical') as asset_type, 
        u.name as user_name, u.nip as user_nip,
        v.name as return_validator_name, v.nip as return_validator_nip,
        r.name as returned_by_name, r.nip as returned_by_nip
      FROM borrowing_records b
      LEFT JOIN medical_assets ma 
        ON b.asset_id = ma.id 
        AND (b.asset_type = 'medical' OR b.asset_type IS NULL)
      LEFT JOIN non_medical_assets na 
        ON b.asset_id = na.id 
        AND b.asset_type = 'non_medical'
      JOIN users u ON b.user_id = u.id
      LEFT JOIN users v ON b.return_validated_by = v.id
      LEFT JOIN users r ON b.returned_by = r.id
      WHERE 1=1
    `;

    let countQuery = 'SELECT COUNT(*) as count FROM borrowing_records WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];

    if (status) {
      query += ' AND b.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (userId) {
      query += ' AND b.user_id = ?';
      countQuery += ' AND user_id = ?';
      params.push(userId);
      countParams.push(userId);
    }

    if (assetId) {
      query += ' AND b.asset_id = ?';
      countQuery += ' AND asset_id = ?';
      params.push(assetId);
      countParams.push(assetId);
    }

    // Filter berdasarkan asset_type (medis/non-medis)
    if (assetType) {
      query += " AND COALESCE(b.asset_type, 'medical') = ?";
      countQuery += " AND COALESCE(asset_type, 'medical') = ?";
      params.push(assetType);
      countParams.push(assetType);
    }

    query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [dataRows] = await pool.query<BorrowingRow[]>(query, params);
    const [countRows] = await pool.query<CountRow[]>(countQuery, countParams);

    const total = countRows[0].count;

    return {
      success: true,
      message: 'Borrowings retrieved successfully',
      data: dataRows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async getById(id: string): Promise<ApiResponse<Borrowing>> {
    // Query getById disamakan logikanya dengan getAll untuk konsistensi
    const [rows] = await pool.query<BorrowingRow[]>(
      `SELECT b.*,
        COALESCE(ma.name, na.name) as asset_name,
        COALESCE(ma.asset_code, na.asset_code) as asset_code,
        COALESCE(ma.location, na.location) as asset_location,
        COALESCE(b.asset_type, 'medical') as asset_type,
        u.name as user_name, u.nip as user_nip,
        v.name as return_validator_name, v.nip as return_validator_nip,
        r.name as returned_by_name, r.nip as returned_by_nip
       FROM borrowing_records b
       LEFT JOIN medical_assets ma 
         ON b.asset_id = ma.id 
         AND (b.asset_type = 'medical' OR b.asset_type IS NULL)
       LEFT JOIN non_medical_assets na 
         ON b.asset_id = na.id 
         AND b.asset_type = 'non_medical'
       JOIN users u ON b.user_id = u.id
       LEFT JOIN users v ON b.return_validated_by = v.id
       LEFT JOIN users r ON b.returned_by = r.id
       WHERE b.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Borrowing not found' };
    }

    return { success: true, message: 'Borrowing retrieved successfully', data: rows[0] };
  }

  async create(data: CreateBorrowingDTO): Promise<ApiResponse<Borrowing>> {
    const borrowingCode = generateBorrowingCode();
    // Default ke 'medical' jika tidak diset, untuk backward compatibility
    const assetType = data.assetType || 'medical'; 
    // dueDate sekarang opsional; fallback ke borrowDate agar kolom DB tetap terisi
    const dueDate = data.dueDate || data.borrowDate;

    // Panggil assetService dengan menyertakan tipe aset
    const asset = await this.assetService.getById(String(data.assetId), assetType);
    if (!asset.success) {
      return { success: false, message: asset.message || 'Asset not found' };
    }

    const assetStatus = (asset.data?.status || '').toLowerCase();
    const detailId = data.assetDetailId?.trim();
    const isAssetFallbackDetail = detailId && detailId === `asset-${data.assetId}`;

    // --- Validasi Ketersediaan Aset (Logic diperbaiki sedikit untuk readability) ---
    
    // Cek 1: Jika meminjam Detail Item spesifik
    if (detailId && !isAssetFallbackDetail) {
      const details = this.getAssetDetails(asset.data?.specifications);
      const selectedDetail = this.findDetailById(details, detailId);
      const detailStatus = String(selectedDetail?.status || '').toLowerCase();
      const detailCondition = String(selectedDetail?.condition || '').toLowerCase();
      const isDetailBlocked = [
        'maintenance',
        'perbaikan',
        'non-aktif',
        'non aktif',
        'disposed',
        'dipinjam',
        'borrowed'
      ].some((status) => detailStatus.includes(status)) || ['rusak', 'damaged'].some((status) => detailCondition.includes(status));

      if (selectedDetail && isDetailBlocked) {
        return { success: false, message: 'Selected asset item is not available for borrowing' };
      }

      // Cek apakah MASTER aset sedang dipinjam (jika sistem mengunci master saat detail dipinjam)
      const [assetLevelRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM borrowing_records
         WHERE asset_id = ? AND asset_type = ? AND (asset_detail_id IS NULL OR asset_detail_id = ?)
           AND status IN ('pending', 'approved', 'borrowed', 'overdue')
         LIMIT 1`,
        [data.assetId, assetType, `asset-${data.assetId}`]
      );

      if (assetLevelRows.length > 0) {
        return { success: false, message: 'Asset is currently locked by another transaction' };
      }

      // Cek apakah DETAIL aset spesifik ini sedang dipinjam
      const [activeRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM borrowing_records
         WHERE asset_id = ? AND asset_type = ? AND asset_detail_id = ?
           AND status IN ('pending', 'approved', 'borrowed', 'overdue')
         LIMIT 1`,
        [data.assetId, assetType, detailId]
      );

      if (activeRows.length > 0) {
        return { success: false, message: 'Selected asset item is currently unavailable/borrowed' };
      }
    } 
    // Cek 2: Jika meminjam Aset Master (tanpa detail spesifik)
    else {
      // Cek apakah ada detail item yang sedang dipinjam (jika meminjam master berarti meminjam semua)
      const [detailRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM borrowing_records
         WHERE asset_id = ? AND asset_type = ? AND asset_detail_id IS NOT NULL
           AND status IN ('pending', 'approved', 'borrowed', 'overdue')
         LIMIT 1`,
        [data.assetId, assetType]
      );

      if (detailRows.length > 0) {
        return { success: false, message: 'Cannot borrow asset master because some items are currently borrowed' };
      }

      const isAvailable = ['available', 'aktif', 'active'].includes(assetStatus);
      if (!isAvailable) {
        return { success: false, message: 'Asset is not available for borrowing' };
      }
    }

    // Insert Data
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO borrowing_records (
         borrowing_code,
         asset_id,
         asset_type,
         asset_detail_id,
         asset_detail_name,
         asset_detail_code,
         user_id,
         borrow_date,
         due_date,
         purpose,
         notes,
         status,
         created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        borrowingCode,
        data.assetId,
        assetType, // Pastikan ini tersimpan ('medical' atau 'non_medical')
        detailId || null,
        data.assetDetailName || null,
        data.assetDetailCode || null,
        data.userId,
        data.borrowDate,
        dueDate,
        data.purpose,
        data.notes || null
      ]
    );

    // Fetch hasil insert untuk dikembalikan (gunakan getById agar join tabel aset berjalan)
    return await this.getById(String(result.insertId));
  }

  private getAssetDetails(specifications?: unknown): any[] {
    if (!specifications) return [];
    if (typeof specifications === 'string') {
      try {
        const parsed = JSON.parse(specifications) as { details?: any[] };
        return Array.isArray(parsed?.details) ? parsed.details : [];
      } catch {
        return [];
      }
    }
    if (typeof specifications === 'object') {
      const details = (specifications as { details?: any[] }).details;
      return Array.isArray(details) ? details : [];
    }
    return [];
  }

  private findDetailById(details: any[], detailId: string): any | undefined {
    return details.find((detail) => {
      const idValue = detail?.id ? String(detail.id) : '';
      const codeValue = detail?.assetCode ? String(detail.assetCode) : '';
      return detailId === idValue || detailId === codeValue;
    });
  }

  async approve(id: string, approvedBy: number): Promise<ApiResponse<Borrowing>> {
    const borrowing = await this.getById(id);
    if (!borrowing.success) return borrowing;

    if (borrowing.data?.status !== 'pending') {
      return { success: false, message: 'Only pending borrowings can be approved' };
    }

    const isAssetFallbackDetail =
      borrowing.data?.assetDetailId && borrowing.data.assetDetailId === `asset-${borrowing.data.assetId}`;
    
    // Update status aset (pastikan mengirim assetType yang benar ke AssetService)
    if (!borrowing.data?.assetDetailId || isAssetFallbackDetail) {
      await this.assetService.updateStatus(
        String(borrowing.data.assetId),
        'borrowed',
        borrowing.data.assetType || 'medical' 
      );
    }

    await pool.query(
      'UPDATE borrowing_records SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?',
      ['approved', approvedBy, id]
    );

    return await this.getById(id);
  }

  async validateReturn(id: string, validatorId: number): Promise<ApiResponse<Borrowing>> {
    const borrowing = await this.getById(id);
    if (!borrowing.success) return borrowing;

    if (borrowing.data?.status !== 'returned') {
      return { success: false, message: 'Only returned borrowings can be validated' };
    }

    if (borrowing.data?.returnValidatedBy) {
      return { success: false, message: 'Return already validated' };
    }

    await pool.query(
      'UPDATE borrowing_records SET return_validated_by = ?, return_validated_at = NOW(), updated_at = NOW() WHERE id = ?',
      [validatorId, id]
    );

    return this.getById(id);
  }

  async reject(id: string, rejectedBy: number, reason: string): Promise<ApiResponse<Borrowing>> {
    const borrowing = await this.getById(id);
    if (!borrowing.success) return borrowing;

    if (borrowing.data?.status !== 'pending') {
      return { success: false, message: 'Only pending borrowings can be rejected' };
    }

    await pool.query(
      'UPDATE borrowing_records SET status = ?, rejected_by = ?, rejected_at = NOW(), rejection_reason = ?, updated_at = NOW() WHERE id = ?',
      ['rejected', rejectedBy, reason, id]
    );

    return await this.getById(id);
  }

  async return(id: string, data: ReturnBorrowingDTO): Promise<ApiResponse<Borrowing>> {
    const borrowing = await this.getById(id);
    if (!borrowing.success) return borrowing;

    if (borrowing.data?.status !== 'approved' && borrowing.data?.status !== 'borrowed') {
      return { success: false, message: 'Only approved/borrowed items can be returned' };
    }

    const isAssetFallbackDetail =
      borrowing.data?.assetDetailId && borrowing.data.assetDetailId === `asset-${borrowing.data.assetId}`;
    
    // Update status aset menjadi 'available' (pastikan assetType terkirim)
    if (!borrowing.data?.assetDetailId || isAssetFallbackDetail) {
      await this.assetService.updateStatus(
        String(borrowing.data.assetId),
        'available',
        borrowing.data.assetType || 'medical'
      );
    }

    await pool.query(
      'UPDATE borrowing_records SET status = ?, return_date = NOW(), return_condition = ?, return_notes = ?, returned_by = ?, updated_at = NOW() WHERE id = ?',
      ['returned', data.condition, data.notes || null, data.returnedBy || null, id]
    );

    return await this.getById(id);
  }

  async update(id: string, data: UpdateBorrowingDTO): Promise<ApiResponse<Borrowing>> {
    const borrowing = await this.getById(id);
    if (!borrowing.success || !borrowing.data) {
      return { success: false, message: 'Borrowing not found' };
    }

    const editableStatuses = ['pending', 'approved'];
    const returnStatus = 'returned';
    const rowsToUpdate: { field: string; value: any }[] = [];

    const hasBorrowFields = [
      data.borrowDate !== undefined,
      data.dueDate !== undefined,
      data.purpose !== undefined,
      data.notes !== undefined,
    ].some(Boolean);

    if (hasBorrowFields) {
      if (!editableStatuses.includes(borrowing.data.status)) {
        return { success: false, message: 'Hanya peminjaman dengan status pending/approved yang bisa diubah' };
      }
      if (data.borrowDate !== undefined) {
        rowsToUpdate.push({ field: 'borrow_date', value: data.borrowDate });
      }
      if (data.dueDate !== undefined) {
        rowsToUpdate.push({ field: 'due_date', value: data.dueDate });
      }
      if (data.purpose !== undefined) {
        rowsToUpdate.push({ field: 'purpose', value: data.purpose });
      }
      if (data.notes !== undefined) {
        rowsToUpdate.push({ field: 'notes', value: data.notes });
      }
    }

    const hasReturnFields = [
      data.returnCondition !== undefined,
      data.returnNotes !== undefined,
    ].some(Boolean);

    if (hasReturnFields) {
      if (borrowing.data.status !== returnStatus) {
        return { success: false, message: 'Hanya pengembalian bertatus returned yang bisa diubah' };
      }
      if (data.returnCondition !== undefined) {
        rowsToUpdate.push({ field: 'return_condition', value: data.returnCondition });
      }
      if (data.returnNotes !== undefined) {
        rowsToUpdate.push({ field: 'return_notes', value: data.returnNotes });
      }
    }

    if (rowsToUpdate.length === 0) {
      return { success: false, message: 'Tidak ada perubahan yang dikirimkan' };
    }

    const clause = rowsToUpdate.map((row) => `${row.field} = ?`).join(', ');
    const params = rowsToUpdate.map((row) => row.value);
    params.push(id);

    await pool.query(
      `UPDATE borrowing_records SET ${clause}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return this.getById(id);
  }

  async delete(id: string): Promise<ApiResponse> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, asset_id, asset_type, asset_detail_id, status FROM borrowing_records WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Borrowing not found' };
    }

    const borrowing = rows[0] as {
      asset_id: number;
      asset_type?: string | null;
      asset_detail_id?: string | null;
      status: string;
    };

    const assetId = borrowing.asset_id;
    const assetType = borrowing.asset_type || 'medical';
    const assetDetailId = borrowing.asset_detail_id || undefined;
    const isAssetFallbackDetail = assetDetailId && assetDetailId === `asset-${assetId}`;

    const shouldReleaseAsset =
      ['approved', 'borrowed', 'overdue'].includes(borrowing.status) &&
      (!assetDetailId || isAssetFallbackDetail);

    if (shouldReleaseAsset) {
      const [activeRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM borrowing_records
         WHERE asset_id = ? AND COALESCE(asset_type, 'medical') = ?
           AND id <> ?
           AND status IN ('pending', 'approved', 'borrowed', 'overdue')
         LIMIT 1`,
        [assetId, assetType, id]
      );

      if (activeRows.length === 0) {
        await this.assetService.updateStatus(String(assetId), 'available', assetType);
      }
    }

    const [result] = await pool.query<ResultSetHeader>('DELETE FROM borrowing_records WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return { success: false, message: 'Borrowing not found' };
    }

    return { success: true, message: 'Borrowing deleted successfully' };
  }
}

export default new BorrowingService();
