import fs, { promises as fsPromises } from 'fs';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import path from 'path';
import pool from '../config/database';
import { ApiResponse } from '../models';

interface ReportFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
  type?: string;
  status?: string;
  reportType?: string;
}

interface StatsRow extends RowDataPacket {
  total: number;
  total_medical: number;
  total_non_medical: number;
  available: number;
  borrowed: number;
  maintenance: number;
  pending: number;
  active: number;
  scheduled: number;
}

interface DashboardStats {
  totalAssets: number;
  totalMedicalAssets: number;
  totalNonMedicalAssets: number;
  availableAssets: number;
  borrowedAssets: number;
  maintenanceAssets: number;
  totalBorrowings: number;
  pendingBorrowings: number;
  activeBorrowings: number;
  totalMaintenance: number;
  scheduledMaintenance: number;
  totalUsers: number;
}

export interface ReportUpload {
  id: number;
  userId?: number | null;
  filename: string;
  contentType: string;
  sizeBytes: number;
  storedPath: string | null;
  uploadedAt: string;
  notes?: string | null;
  downloadPath: string;
  previewPath?: string;
}

interface ReportUploadRow extends RowDataPacket {
  id: number;
  user_id: number | null;
  filename: string;
  content_type: string;
  size_bytes: number;
  stored_path: string | null;
  uploaded_at: Date;
  notes: string | null;
}

export class ReportService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'reports');
  }

  private async ensureUploadDir(): Promise<void> {
    await fsPromises.mkdir(this.uploadDir, { recursive: true });
  }

  private mapUploadRow(row: ReportUploadRow): ReportUpload {
    return {
      id: Number(row.id),
      userId: row.user_id ? Number(row.user_id) : null,
      filename: row.filename,
      contentType: row.content_type || 'application/octet-stream',
      sizeBytes: Number(row.size_bytes) || 0,
      storedPath: row.stored_path,
      uploadedAt: row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : (row.uploaded_at as unknown as string),
      notes: row.notes,
      downloadPath: `/reports/uploads/${row.id}/download`,
      previewPath: `/reports/uploads/${row.id}/preview`,
    };
  }

  getUploadFilePath(storedPath: string | null | undefined): string {
    if (!storedPath) {
      return this.uploadDir;
    }
    return path.join(this.uploadDir, storedPath);
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    const [assetsStats] = await pool.query<StatsRow[]>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN type = 'medical' THEN 1 ELSE 0 END) as total_medical,
        SUM(CASE WHEN type = 'non_medical' THEN 1 ELSE 0 END) as total_non_medical,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'borrowed' THEN 1 ELSE 0 END) as borrowed,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
      FROM medical_assets
    `);

    const [borrowingStats] = await pool.query<StatsRow[]>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status IN ('approved', 'borrowed') THEN 1 ELSE 0 END) as active
      FROM borrowing_records
    `);

    const [maintenanceStats] = await pool.query<StatsRow[]>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled
      FROM maintenance_records
    `);

    const [userStats] = await pool.query<StatsRow[]>('SELECT COUNT(*) as total FROM users');

    const assets = assetsStats[0];
    const borrowings = borrowingStats[0];
    const maintenance = maintenanceStats[0];
    const users = userStats[0];

    return {
      success: true,
      message: 'Dashboard stats retrieved successfully',
      data: {
        totalAssets: Number(assets.total) || 0,
        totalMedicalAssets: Number(assets.total_medical) || 0,
        totalNonMedicalAssets: Number(assets.total_non_medical) || 0,
        availableAssets: Number(assets.available) || 0,
        borrowedAssets: Number(assets.borrowed) || 0,
        maintenanceAssets: Number(assets.maintenance) || 0,
        totalBorrowings: Number(borrowings.total) || 0,
        pendingBorrowings: Number(borrowings.pending) || 0,
        activeBorrowings: Number(borrowings.active) || 0,
        totalMaintenance: Number(maintenance.total) || 0,
        scheduledMaintenance: Number(maintenance.scheduled) || 0,
        totalUsers: Number(users.total) || 0
      }
    };
  }

  async saveUpload(file: Express.Multer.File, userId?: number | string, notes?: string): Promise<ApiResponse<ReportUpload>> {
    await this.ensureUploadDir();

    const storedPath = path.basename(file.filename || file.originalname);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO report_uploads (user_id, filename, content_type, size_bytes, stored_path, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId ? Number(userId) : null,
        file.originalname,
        file.mimetype || 'application/octet-stream',
        file.size || 0,
        storedPath,
        notes || null,
      ]
    );

    const [rows] = await pool.query<ReportUploadRow[]>('SELECT * FROM report_uploads WHERE id = ?', [result.insertId]);

    return { success: true, message: 'Report uploaded successfully', data: this.mapUploadRow(rows[0]) };
  }

  async getUploads(): Promise<ApiResponse<ReportUpload[]>> {
    const [rows] = await pool.query<ReportUploadRow[]>('SELECT * FROM report_uploads ORDER BY uploaded_at DESC');
    return { success: true, message: 'Uploads retrieved successfully', data: rows.map((row) => this.mapUploadRow(row)) };
  }

  async getUploadById(id: number | string): Promise<ApiResponse<ReportUpload>> {
    const [rows] = await pool.query<ReportUploadRow[]>('SELECT * FROM report_uploads WHERE id = ?', [id]);
    if (rows.length === 0) {
      return { success: false, message: 'Report upload not found' };
    }
    return { success: true, message: 'Upload retrieved successfully', data: this.mapUploadRow(rows[0]) };
  }

  async deleteUpload(id: number | string): Promise<ApiResponse> {
    const existing = await this.getUploadById(id);
    if (!existing.success || !existing.data) {
      return { success: false, message: 'Upload tidak ditemukan' };
    }

    if (existing.data.storedPath) {
      const filePath = this.getUploadFilePath(existing.data.storedPath);
      const exists = await this.fileExists(filePath);
      if (exists) {
        try {
          await fsPromises.unlink(filePath);
        } catch (error) {
          console.error('Delete upload file error:', error);
        }
      }
    }

    await pool.query<ResultSetHeader>('DELETE FROM report_uploads WHERE id = ?', [id]);
    return { success: true, message: 'Upload berhasil dihapus' };
  }

  async getAssetReport(filters: ReportFilters): Promise<ApiResponse> {
    let query = `
      SELECT 
        a.*,
        (SELECT COUNT(*) FROM borrowing_records b WHERE b.asset_id = a.id) as total_borrowings,
        (SELECT COUNT(*) FROM maintenance_records m WHERE m.asset_id = a.id) as total_maintenance
      FROM medical_assets a
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.startDate) {
      query += ' AND a.created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND a.created_at <= ?';
      params.push(filters.endDate);
    }

    if (filters.category) {
      query += ' AND a.category = ?';
      params.push(filters.category);
    }

    if (filters.type) {
      query += ' AND a.type = ?';
      params.push(filters.type);
    }

    query += ' ORDER BY a.created_at DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return { success: true, message: 'Asset report generated successfully', data: rows };
  }

  async getBorrowingReport(filters: ReportFilters): Promise<ApiResponse> {
    let query = `
      SELECT 
        b.*,
        a.name as asset_name,
        a.asset_code,
        u.name as user_name,
        u.nip
      FROM borrowing_records b
      JOIN medical_assets a ON b.asset_id = a.id
      JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.startDate) {
      query += ' AND b.borrow_date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND b.borrow_date <= ?';
      params.push(filters.endDate);
    }

    if (filters.status) {
      query += ' AND b.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY b.created_at DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return { success: true, message: 'Borrowing report generated successfully', data: rows };
  }

  async getMaintenanceReport(filters: ReportFilters): Promise<ApiResponse> {
    let query = `
      SELECT 
        m.*,
        a.name as asset_name,
        a.asset_code
      FROM maintenance_records m
      JOIN medical_assets a ON m.asset_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.startDate) {
      query += ' AND m.scheduled_date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND m.scheduled_date <= ?';
      params.push(filters.endDate);
    }

    if (filters.type) {
      query += ' AND m.type = ?';
      params.push(filters.type);
    }

    query += ' ORDER BY m.scheduled_date DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return { success: true, message: 'Maintenance report generated successfully', data: rows };
  }

  async exportToPdf(_filters: ReportFilters): Promise<Buffer> {
    // TODO: Implementasi PDF export menggunakan library seperti pdfkit atau puppeteer
    throw new Error('PDF export belum diimplementasikan. Silakan gunakan export Excel terlebih dahulu.');
  }

  async exportToExcel(_filters: ReportFilters): Promise<Buffer> {
    // TODO: Implementasi Excel export menggunakan library seperti exceljs
    throw new Error('Excel export belum diimplementasikan. Fitur ini akan segera tersedia.');
  }
}

export default new ReportService();
