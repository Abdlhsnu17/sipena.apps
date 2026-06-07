import ExcelJS from 'exceljs';
import fs, { promises as fsPromises } from 'fs';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import path from 'path';
import pool from '../config/database';
import { ApiResponse } from '../models';
import { hasAnyRole } from '../utils/role';
import { getReportUploadsDir } from '../utils/storage-paths';

interface ReportFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
  type?: string;
  status?: string;
  reportType?: string;
  userId?: string;
  actorUserId?: number | string | null;
  actorRole?: string | null;
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
  overdue: number;
  active_sanctions: number;
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
  overdueBorrowings: number;
  activeSanctions: number;
  totalMaintenance: number;
  scheduledMaintenance: number;
  totalUsers: number;
  assetStatusSummary: Array<{ status: string; total: number }>;
  borrowingStatusSummary: Array<{ status: string; total: number }>;
  maintenanceStatusSummary: Array<{ status: string; total: number }>;
  dueNotifications: DueNotification[];
}

type DueNotificationType = 'borrowing_overdue' | 'borrowing_due_soon' | 'maintenance_due_soon';

interface DueNotification {
  id: number;
  type: DueNotificationType;
  title: string;
  description: string;
  dueDate: string | null;
  daysRemaining: number;
  severity: 'danger' | 'warning' | 'info';
  href: string;
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

interface ColumnCountRow extends RowDataPacket {
  count: number;
}

interface SummaryRow extends RowDataPacket {
  label: string;
  total: number;
}

interface ExportSheet {
  title: string;
  rows: Record<string, unknown>[];
  columns?: string[];
}

interface UploadValidationResult {
  valid: boolean;
  message?: string;
}

interface DueBorrowingRow extends RowDataPacket {
  id: number;
  borrowing_code: string | null;
  due_date: Date | string | null;
  status: string;
  asset_name: string | null;
  user_name: string | null;
  days_remaining: number;
}

interface DueMaintenanceRow extends RowDataPacket {
  id: number;
  maintenance_code: string | null;
  scheduled_date: Date | string | null;
  status: string;
  asset_name: string | null;
  technician: string | null;
  days_remaining: number;
}

const toIsoDate = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const formatCellValue = (value: unknown): string | number | Date => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  return value as string | number;
};

const escapePdfText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const formatPdfValue = (value: unknown): string => {
  const formatted = formatCellValue(value);
  if (formatted instanceof Date) {
    return formatted.toLocaleString('id-ID');
  }
  return String(formatted).replace(/\s+/g, ' ').trim();
};

const getFilterSummary = (filters: ReportFilters): string[] => [
  filters.startDate || filters.endDate ? `Periode: ${filters.startDate || 'awal'} s/d ${filters.endDate || 'akhir'}` : 'Periode: Semua data',
  filters.category ? `Kategori: ${filters.category}` : null,
  filters.type ? `Jenis: ${filters.type}` : null,
  filters.status ? `Status: ${filters.status}` : null,
  filters.userId ? `User ID: ${filters.userId}` : null,
].filter((item): item is string => Boolean(item));

const wrapText = (value: string, width: number): string[] => {
  if (value.length <= width) return [value];
  const words = value.split(' ');
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    if (!current) {
      current = word;
      return;
    }
    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
      return;
    }
    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines.flatMap((line) => {
    if (line.length <= width) return [line];
    const chunks: string[] = [];
    for (let index = 0; index < line.length; index += width) {
      chunks.push(line.slice(index, index + width));
    }
    return chunks;
  });
};

const normalizeExportType = (value?: string): 'assets' | 'borrowing' | 'maintenance' | 'usage' | 'activity' | 'all' => {
  if (value === 'borrowing' || value === 'maintenance' || value === 'usage' || value === 'activity' || value === 'all') return value;
  return 'assets';
};

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export class ReportService {
  private uploadDir: string;
  private borrowingSanctionColumnAvailable: boolean | null = null;

  constructor() {
    this.uploadDir = getReportUploadsDir();
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

  private async hasBorrowingSanctionColumn(): Promise<boolean> {
    if (this.borrowingSanctionColumnAvailable !== null) {
      return this.borrowingSanctionColumnAvailable;
    }

    try {
      const [rows] = await pool.query<ColumnCountRow[]>(
        `SELECT COUNT(*) as count
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'borrowing_records'
           AND column_name = 'sanction_status'`
      );

      this.borrowingSanctionColumnAvailable = Number(rows[0]?.count || 0) === 1;
    } catch {
      this.borrowingSanctionColumnAvailable = false;
    }

    return this.borrowingSanctionColumnAvailable;
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

  async validateUploadFileSignature(file: Express.Multer.File): Promise<UploadValidationResult> {
    const extension = path.extname(file.originalname).toLowerCase();
    const handle = await fsPromises.open(file.path, 'r');
    try {
      const buffer = Buffer.alloc(12);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      const header = buffer.subarray(0, bytesRead);
      const startsWith = (...bytes: number[]) => bytes.every((byte, index) => header[index] === byte);

      const valid =
        (extension === '.pdf' && header.subarray(0, 4).toString('ascii') === '%PDF') ||
        ((extension === '.png') && startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) ||
        ((extension === '.jpg' || extension === '.jpeg') && startsWith(0xff, 0xd8, 0xff)) ||
        (extension === '.webp' && header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP') ||
        ((extension === '.docx' || extension === '.xlsx') && startsWith(0x50, 0x4b, 0x03, 0x04)) ||
        ((extension === '.doc' || extension === '.xls') && startsWith(0xd0, 0xcf, 0x11, 0xe0));

      return valid
        ? { valid: true }
        : { valid: false, message: 'Isi file tidak sesuai dengan ekstensi laporan' };
    } finally {
      await handle.close();
    }
  }

  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    const hasBorrowingSanctionColumn = await this.hasBorrowingSanctionColumn();

    const [assetsStats] = await pool.query<StatsRow[]>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN type = 'medical' THEN 1 ELSE 0 END) as total_medical,
        SUM(CASE WHEN type = 'non_medical' THEN 1 ELSE 0 END) as total_non_medical,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'borrowed' THEN 1 ELSE 0 END) as borrowed,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
      FROM (
        SELECT status, 'medical' as type FROM medical_assets
        UNION ALL
        SELECT status, 'non_medical' as type FROM non_medical_assets
      ) assets
    `);

    const borrowingStatsQuery = hasBorrowingSanctionColumn
      ? `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status IN ('approved', 'borrowed') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN sanction_status = 'active' THEN 1 ELSE 0 END) as active_sanctions
      FROM borrowing_records
    `
      : `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status IN ('approved', 'borrowed') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
        0 as active_sanctions
      FROM borrowing_records
    `;

    const [borrowingStats] = await pool.query<StatsRow[]>(borrowingStatsQuery);

    const [maintenanceStats] = await pool.query<StatsRow[]>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled
      FROM maintenance_records
    `);

    const [userStats] = await pool.query<StatsRow[]>('SELECT COUNT(*) as total FROM users');
    const [assetStatusRows] = await pool.query<SummaryRow[]>(`
      SELECT status as label, COUNT(*) as total
      FROM (
        SELECT status FROM medical_assets
        UNION ALL
        SELECT status FROM non_medical_assets
      ) assets
      GROUP BY status
      ORDER BY total DESC
    `);
    const [borrowingStatusRows] = await pool.query<SummaryRow[]>(`
      SELECT status as label, COUNT(*) as total
      FROM borrowing_records
      GROUP BY status
      ORDER BY total DESC
    `);
    const [maintenanceStatusRows] = await pool.query<SummaryRow[]>(`
      SELECT status as label, COUNT(*) as total
      FROM maintenance_records
      GROUP BY status
      ORDER BY total DESC
    `);
    const dueNotifications = await this.getDueNotifications();

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
        overdueBorrowings: Number(borrowings.overdue) || 0,
        activeSanctions: Number(borrowings.active_sanctions) || 0,
        totalMaintenance: Number(maintenance.total) || 0,
        scheduledMaintenance: Number(maintenance.scheduled) || 0,
        totalUsers: Number(users.total) || 0,
        assetStatusSummary: assetStatusRows.map((row) => ({ status: row.label || 'unknown', total: Number(row.total) || 0 })),
        borrowingStatusSummary: borrowingStatusRows.map((row) => ({ status: row.label || 'unknown', total: Number(row.total) || 0 })),
        maintenanceStatusSummary: maintenanceStatusRows.map((row) => ({ status: row.label || 'unknown', total: Number(row.total) || 0 })),
        dueNotifications,
      }
    };
  }

  async getDueNotifications(): Promise<DueNotification[]> {
    const [borrowingRows] = await pool.query<DueBorrowingRow[]>(`
      SELECT b.id,
             b.borrowing_code,
             b.due_date,
             b.status,
             COALESCE(b.asset_detail_name, ma.name, na.name) as asset_name,
             u.name as user_name,
             DATEDIFF(DATE(b.due_date), CURDATE()) as days_remaining
      FROM borrowing_records b
      LEFT JOIN medical_assets ma ON b.asset_id = ma.id AND (b.asset_type IS NULL OR b.asset_type = 'medical')
      LEFT JOIN non_medical_assets na ON b.asset_id = na.id AND b.asset_type = 'non_medical'
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.due_date IS NOT NULL
        AND b.status IN ('approved', 'borrowed', 'overdue')
        AND DATEDIFF(DATE(b.due_date), CURDATE()) <= 3
      ORDER BY days_remaining ASC, b.due_date ASC
      LIMIT 8
    `);

    const [maintenanceRows] = await pool.query<DueMaintenanceRow[]>(`
      SELECT m.id,
             m.maintenance_code,
             m.scheduled_date,
             m.status,
             COALESCE(m.asset_detail_name, ma.name, na.name) as asset_name,
             m.technician,
             DATEDIFF(DATE(m.scheduled_date), CURDATE()) as days_remaining
      FROM maintenance_records m
      LEFT JOIN medical_assets ma ON m.asset_id = ma.id AND (m.asset_type IS NULL OR m.asset_type = 'medical')
      LEFT JOIN non_medical_assets na ON m.asset_id = na.id AND m.asset_type = 'non_medical'
      WHERE m.scheduled_date IS NOT NULL
        AND m.status NOT IN ('validated', 'cancelled')
        AND DATEDIFF(DATE(m.scheduled_date), CURDATE()) BETWEEN 0 AND 7
      ORDER BY days_remaining ASC, m.scheduled_date ASC
      LIMIT 8
    `);

    const borrowingNotifications = borrowingRows.map<DueNotification>((row) => {
      const daysRemaining = Number(row.days_remaining) || 0;
      const overdue = daysRemaining < 0 || row.status === 'overdue';
      const code = row.borrowing_code ? ` ${row.borrowing_code}` : '';
      const assetName = row.asset_name || 'Aset';
      const userName = row.user_name || 'Pengguna';
      return {
        id: Number(row.id),
        type: overdue ? 'borrowing_overdue' : 'borrowing_due_soon',
        title: overdue ? `Peminjaman terlambat${code}` : `Peminjaman jatuh tempo${code}`,
        description: overdue
          ? `${assetName} oleh ${userName} terlambat ${Math.abs(daysRemaining)} hari`
          : `${assetName} oleh ${userName} jatuh tempo dalam ${daysRemaining} hari`,
        dueDate: toIsoDate(row.due_date),
        daysRemaining,
        severity: overdue ? 'danger' : 'warning',
        href: '/returns',
      };
    });

    const maintenanceNotifications = maintenanceRows.map<DueNotification>((row) => {
      const daysRemaining = Number(row.days_remaining) || 0;
      const code = row.maintenance_code ? ` ${row.maintenance_code}` : '';
      return {
        id: Number(row.id),
        type: 'maintenance_due_soon',
        title: `Pemeliharaan terjadwal${code}`,
        description: `${row.asset_name || 'Aset'} dijadwalkan dalam ${daysRemaining} hari${row.technician ? ` oleh ${row.technician}` : ''}`,
        dueDate: toIsoDate(row.scheduled_date),
        daysRemaining,
        severity: daysRemaining <= 1 ? 'warning' : 'info',
        href: '/maintenance',
      };
    });

    return [...borrowingNotifications, ...maintenanceNotifications]
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 10);
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
        (SELECT COUNT(*) FROM borrowing_records b WHERE b.asset_id = a.id AND COALESCE(b.asset_type, 'medical') = a.type) as total_borrowings,
        (SELECT COUNT(*) FROM maintenance_records m WHERE m.asset_id = a.id AND COALESCE(m.asset_type, 'medical') = a.type) as total_maintenance
      FROM (
        SELECT id, asset_code, name, description, category, type, status, \`condition\`, location, purchase_date, purchase_price, warranty_expiry, specifications, image_url, created_at, updated_at
        FROM medical_assets
        UNION ALL
        SELECT id, asset_code, name, NULL as description, category, 'non_medical' as type, status, \`condition\`, location, purchase_date, NULL as purchase_price, warranty_expiry, NULL as specifications, NULL as image_url, created_at, updated_at
        FROM non_medical_assets
      ) a
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
        COALESCE(b.asset_detail_name, ma.name, na.name) as asset_name,
        COALESCE(b.asset_detail_code, ma.asset_code, na.asset_code) as asset_code,
        u.name as user_name,
        u.nip
      FROM borrowing_records b
      LEFT JOIN medical_assets ma ON b.asset_id = ma.id AND (b.asset_type IS NULL OR b.asset_type = 'medical')
      LEFT JOIN non_medical_assets na ON b.asset_id = na.id AND b.asset_type = 'non_medical'
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
        COALESCE(m.asset_detail_name, ma.name, na.name) as asset_name,
        COALESCE(m.asset_detail_code, ma.asset_code, na.asset_code) as asset_code,
        COALESCE(ma.location, na.location) as asset_location
      FROM maintenance_records m
      LEFT JOIN medical_assets ma ON m.asset_id = ma.id AND (m.asset_type IS NULL OR m.asset_type = 'medical')
      LEFT JOIN non_medical_assets na ON m.asset_id = na.id AND m.asset_type = 'non_medical'
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

  async getUsageReport(filters: ReportFilters): Promise<ApiResponse> {
    let query = `
      SELECT l.*,
        COALESCE(ma.name, na.name) as asset_name,
        COALESCE(ma.asset_code, na.asset_code) as asset_code,
        COALESCE(ma.location, na.location) as asset_location,
        op.name as operator_name,
        op.nip as operator_nip,
        creator.name as created_by_name
      FROM asset_usage_logs l
      LEFT JOIN medical_assets ma ON l.asset_type = 'medical' AND l.asset_id = ma.id
      LEFT JOIN non_medical_assets na ON l.asset_type = 'non_medical' AND l.asset_id = na.id
      LEFT JOIN users op ON l.operator_user_id = op.id
      LEFT JOIN users creator ON l.created_by = creator.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.startDate) {
      query += ' AND l.started_at >= ?';
      params.push(`${filters.startDate} 00:00:00`);
    }

    if (filters.endDate) {
      query += ' AND l.started_at <= ?';
      params.push(`${filters.endDate} 23:59:59`);
    }

    if (filters.type) {
      query += ' AND l.asset_type = ?';
      params.push(filters.type);
    }

    if (filters.status) {
      query += ' AND l.usage_context = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY l.started_at DESC, l.created_at DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return { success: true, message: 'Usage report generated successfully', data: rows };
  }

  async getActivityReport(filters: ReportFilters): Promise<ApiResponse> {
    const actorUserId = toPositiveNumber(filters.actorUserId);
    const requestedUserId = toPositiveNumber(filters.userId);
    const canViewOthers = hasAnyRole(filters.actorRole, ['admin', 'leader']);
    const scopedUserId = canViewOthers ? requestedUserId : actorUserId;

    if (!actorUserId) {
      return { success: false, message: 'User tidak valid', data: [] };
    }

    let query = `
      SELECT
        ual.id,
        ual.user_id,
        u.name AS user_name,
        u.nip AS user_nip,
        ual.feature,
        ual.action,
        ual.description,
        ual.created_at
      FROM user_activity_logs ual
      LEFT JOIN users u ON u.id = ual.user_id
      WHERE NOT (ual.feature = 'pencarian' AND ual.action = 'search')`;
    const params: Array<string | number> = [];

    if (scopedUserId) {
      query += ' AND ual.user_id = ?';
      params.push(scopedUserId);
    }

    if (filters.startDate) {
      query += ' AND DATE(ual.created_at) >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND DATE(ual.created_at) <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY ual.created_at DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return { success: true, message: 'Activity report generated successfully', data: rows };
  }

  async getUploadReport(filters: ReportFilters): Promise<ApiResponse> {
    let query = 'SELECT * FROM report_uploads WHERE 1=1';
    const params: any[] = [];

    if (filters.startDate) {
      query += ' AND uploaded_at >= ?';
      params.push(`${filters.startDate} 00:00:00`);
    }

    if (filters.endDate) {
      query += ' AND uploaded_at <= ?';
      params.push(`${filters.endDate} 23:59:59`);
    }

    query += ' ORDER BY uploaded_at DESC';

    const [rows] = await pool.query<ReportUploadRow[]>(query, params);
    return { success: true, message: 'Upload report generated successfully', data: rows.map((row) => this.mapUploadRow(row)) };
  }

  private async getDashboardSummaryRows(): Promise<Record<string, unknown>[]> {
    const dashboard = await this.getDashboardStats();
    if (!dashboard.success || !dashboard.data) {
      return [];
    }

    const data = dashboard.data;
    return [
      { label: 'Total Aset', value: data.totalAssets },
      { label: 'Aset Medis', value: data.totalMedicalAssets },
      { label: 'Aset Non Medis', value: data.totalNonMedicalAssets },
      { label: 'Aset Tersedia', value: data.availableAssets },
      { label: 'Aset Dipinjam', value: data.borrowedAssets },
      { label: 'Aset Pemeliharaan', value: data.maintenanceAssets },
      { label: 'Total Peminjaman', value: data.totalBorrowings },
      { label: 'Peminjaman Aktif', value: data.activeBorrowings },
      { label: 'Peminjaman Pending', value: data.pendingBorrowings },
      { label: 'Peminjaman Terlambat', value: data.overdueBorrowings },
      { label: 'Pemeliharaan Total', value: data.totalMaintenance },
      { label: 'Pemeliharaan Terjadwal', value: data.scheduledMaintenance },
      { label: 'Pengguna', value: data.totalUsers },
      { label: 'Sanksi Aktif', value: data.activeSanctions },
      { label: 'Notifikasi Mendekati Jatuh Tempo', value: data.dueNotifications.length },
    ];
  }

  private async getExportSheets(filters: ReportFilters): Promise<ExportSheet[]> {
    const reportType = normalizeExportType(filters.reportType);
    if (reportType !== 'all') {
      const rows = await this.getExportRows(filters);
      return [
        {
          title: this.getExportTitle(filters.reportType),
          rows: rows as Record<string, unknown>[],
          columns: this.getExportColumns(rows, filters.reportType),
        },
      ];
    }

    const [summaryRows, assetResult, borrowingResult, maintenanceResult, usageResult, activityResult, uploadResult] = await Promise.all([
      this.getDashboardSummaryRows(),
      this.getAssetReport(filters),
      this.getBorrowingReport(filters),
      this.getMaintenanceReport(filters),
      this.getUsageReport(filters),
      this.getActivityReport(filters),
      this.getUploadReport(filters),
    ]);

    return [
      { title: 'Ringkasan', rows: summaryRows, columns: ['label', 'value'] },
      {
        title: 'Aset',
        rows: ((assetResult.data ?? []) as RowDataPacket[]) as Record<string, unknown>[],
        columns: this.getExportColumns((assetResult.data ?? []) as RowDataPacket[], 'assets'),
      },
      {
        title: 'Peminjaman',
        rows: ((borrowingResult.data ?? []) as RowDataPacket[]) as Record<string, unknown>[],
        columns: this.getExportColumns((borrowingResult.data ?? []) as RowDataPacket[], 'borrowing'),
      },
      {
        title: 'Pemeliharaan',
        rows: ((maintenanceResult.data ?? []) as RowDataPacket[]) as Record<string, unknown>[],
        columns: this.getExportColumns((maintenanceResult.data ?? []) as RowDataPacket[], 'maintenance'),
      },
      {
        title: 'Penggunaan',
        rows: ((usageResult.data ?? []) as RowDataPacket[]) as Record<string, unknown>[],
        columns: this.getExportColumns((usageResult.data ?? []) as RowDataPacket[], 'usage'),
      },
      {
        title: 'Aktivitas',
        rows: ((activityResult.data ?? []) as RowDataPacket[]) as Record<string, unknown>[],
        columns: this.getExportColumns((activityResult.data ?? []) as RowDataPacket[], 'activity'),
      },
      {
        title: 'Unggahan',
        rows: ((uploadResult.data ?? []) as unknown) as Record<string, unknown>[],
        columns: ['id', 'filename', 'contentType', 'sizeBytes', 'uploadedAt', 'notes', 'downloadPath'],
      },
    ];
  }

  private async getExportRows(filters: ReportFilters): Promise<RowDataPacket[]> {
    const reportType = normalizeExportType(filters.reportType);
    if (reportType === 'borrowing') {
      const result = await this.getBorrowingReport(filters);
      return (result.data ?? []) as RowDataPacket[];
    }
    if (reportType === 'maintenance') {
      const result = await this.getMaintenanceReport(filters);
      return (result.data ?? []) as RowDataPacket[];
    }
    if (reportType === 'usage') {
      const result = await this.getUsageReport(filters);
      return (result.data ?? []) as RowDataPacket[];
    }
    if (reportType === 'activity') {
      const result = await this.getActivityReport(filters);
      return (result.data ?? []) as RowDataPacket[];
    }
    const result = await this.getAssetReport(filters);
    return (result.data ?? []) as RowDataPacket[];
  }

  private getExportTitle(reportType?: string): string {
    switch (normalizeExportType(reportType)) {
      case 'borrowing':
        return 'Laporan Peminjaman';
      case 'maintenance':
        return 'Laporan Pemeliharaan';
      case 'usage':
        return 'Laporan Penggunaan';
      case 'activity':
        return 'Laporan Riwayat Aktivitas';
      case 'all':
        return 'Laporan Terpadu';
      default:
        return 'Laporan Aset';
    }
  }

  private getExportColumns(rows: RowDataPacket[], reportType?: string): string[] {
    const preferred = [
      'id',
      'asset_code',
      'asset_name',
      'asset_detail_name',
      'asset_detail_code',
      'name',
      'category',
      'type',
      'asset_type',
      'status',
      'usage_context',
      'room_name',
      'operator_name',
      'operator_nip',
      'started_at',
      'ended_at',
      'usage_count',
      'user_id',
      'user_name',
      'user_nip',
      'feature',
      'action',
      'description',
      'condition_before',
      'condition_after',
      'condition',
      'location',
      'nip',
      'borrow_date',
      'due_date',
      'return_date',
      'scheduled_date',
      'completed_date',
      'technician',
      'cost',
      'total_borrowings',
      'total_maintenance',
      'created_at',
      'updated_at',
    ];
    const keys = rows.reduce<string[]>((acc, row) => {
      Object.keys(row).forEach((key) => {
        if (!acc.includes(key)) acc.push(key);
      });
      return acc;
    }, []);
    const columns = [...preferred.filter((key) => keys.includes(key)), ...keys.filter((key) => !preferred.includes(key))];
    if (columns.length > 0) return columns;
    switch (normalizeExportType(reportType)) {
      case 'borrowing':
        return ['id', 'borrowing_code', 'asset_name', 'user_name', 'status', 'borrow_date', 'due_date'];
      case 'maintenance':
        return ['id', 'maintenance_code', 'asset_name', 'type', 'status', 'scheduled_date', 'technician'];
      case 'usage':
        return ['id', 'asset_name', 'asset_code', 'room_name', 'usage_context', 'started_at', 'ended_at', 'usage_count'];
      case 'activity':
        return ['id', 'user_name', 'user_nip', 'feature', 'action', 'description', 'created_at'];
      default:
        return ['id', 'asset_code', 'name', 'category', 'type', 'status', 'location'];
    }
  }

  async exportToPdf(filters: ReportFilters): Promise<Buffer> {
    const sheets = await this.getExportSheets(filters);
    const title = this.getExportTitle(filters.reportType);
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 36;
    const contentWidth = pageWidth - margin * 2;
    const bottomMargin = 44;
    const pages: string[][] = [];
    let operations: string[] = [];
    let y = pageHeight - margin;

    const formatColumnLabel = (key: string): string =>
      key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

    const addPage = () => {
      operations = [];
      pages.push(operations);
      y = pageHeight - margin;
    };

    const color = (hex: string): string => {
      const normalized = hex.replace('#', '');
      const r = parseInt(normalized.slice(0, 2), 16) / 255;
      const g = parseInt(normalized.slice(2, 4), 16) / 255;
      const b = parseInt(normalized.slice(4, 6), 16) / 255;
      return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
    };

    const addText = (
      text: string,
      x: number,
      baseline: number,
      size = 9,
      font: 'F1' | 'F2' = 'F1',
      fill = '#111827',
    ) => {
      operations.push(`BT ${color(fill)} rg /${font} ${size} Tf 1 0 0 1 ${x} ${baseline} Tm (${escapePdfText(text)}) Tj ET`);
    };

    const addRect = (
      x: number,
      rectY: number,
      width: number,
      height: number,
      stroke = '#d7dee8',
      fill?: string,
    ) => {
      if (fill) operations.push(`q ${color(fill)} rg ${x} ${rectY} ${width} ${height} re f Q`);
      operations.push(`q ${color(stroke)} RG 0.75 w ${x} ${rectY} ${width} ${height} re S Q`);
    };

    const addLine = (x1: number, y1: number, x2: number, y2: number, stroke = '#d7dee8', width = 0.75) => {
      operations.push(`q ${color(stroke)} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S Q`);
    };

    const wrapPdfText = (value: string, maxWidth: number, fontSize = 9): string[] => {
      const maxChars = Math.max(12, Math.floor(maxWidth / (fontSize * 0.52)));
      return wrapText(value, maxChars);
    };

    const ensureSpace = (height: number) => {
      if (y - height < bottomMargin) addPage();
    };

    addPage();

    addText('SiPeNa', margin, y, 11, 'F2', '#64748b');
    y -= 24;
    addText(title, margin, y, 20, 'F2', '#0f172a');
    y -= 20;
    addText(`Dibuat: ${new Date().toLocaleString('id-ID')}`, margin, y, 9, 'F1', '#475569');
    y -= 18;
    addLine(margin, y, pageWidth - margin, y, '#cbd5e1', 1);
    y -= 22;

    const filterItems = getFilterSummary(filters);
    const chips = filterItems.length > 0 ? filterItems : ['Periode: Semua data'];
    let chipX = margin;
    chips.forEach((item) => {
      const chipWidth = Math.min(250, Math.max(120, item.length * 5.3 + 22));
      if (chipX + chipWidth > pageWidth - margin) {
        chipX = margin;
        y -= 28;
      }
      addRect(chipX, y - 18, chipWidth, 22, '#dbe4ef', '#f8fafc');
      addText(item, chipX + 10, y - 12, 8.5, 'F1', '#334155');
      chipX += chipWidth + 8;
    });
    y -= 42;

    const drawSectionHeader = (sheet: ExportSheet) => {
      ensureSpace(48);
      addRect(margin, y - 28, contentWidth, 34, '#d7dee8', '#f1f5f9');
      addText(sheet.title, margin + 12, y - 10, 13, 'F2', '#0f172a');
      addText(`Total data: ${sheet.rows.length}`, pageWidth - margin - 112, y - 10, 9, 'F1', '#475569');
      y -= 48;
    };

    const drawRecordHeader = (label: string) => {
      ensureSpace(32);
      addRect(margin, y - 20, contentWidth, 24, '#0f172a', '#0f172a');
      addText(label, margin + 10, y - 12, 9.5, 'F2', '#ffffff');
      y -= 24;
    };

    const drawCell = (x: number, topY: number, width: number, height: number, label: string, value: string) => {
      addRect(x, topY - height, width, height, '#d7dee8', '#ffffff');
      addText(label, x + 8, topY - 13, 7.5, 'F2', '#64748b');
      wrapPdfText(value || '-', width - 16, 8.5).forEach((line, index) => {
        addText(line, x + 8, topY - 27 - index * 10, 8.5, 'F1', '#111827');
      });
    };

    sheets.forEach((sheet) => {
      const columns = sheet.columns ?? this.getExportColumns(sheet.rows as RowDataPacket[], filters.reportType);
      drawSectionHeader(sheet);

      if (sheet.rows.length === 0) {
        addRect(margin, y - 30, contentWidth, 34, '#d7dee8', '#ffffff');
        addText('Tidak ada data pada filter ini.', margin + 12, y - 18, 9.5, 'F1', '#475569');
        y -= 50;
        return;
      }

      sheet.rows.forEach((row, rowIndex) => {
        drawRecordHeader(`Data ${rowIndex + 1}`);
        for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 2) {
          const leftKey = columns[columnIndex];
          const rightKey = columns[columnIndex + 1];
          const cellGap = 8;
          const cellWidth = (contentWidth - cellGap) / 2;
          const leftValue = formatPdfValue(row[leftKey]) || '-';
          const rightValue = rightKey ? formatPdfValue(row[rightKey]) || '-' : '';
          const leftLines = wrapPdfText(leftValue, cellWidth - 16, 8.5).length;
          const rightLines = rightKey ? wrapPdfText(rightValue, cellWidth - 16, 8.5).length : 1;
          const rowHeight = Math.max(42, 30 + Math.max(leftLines, rightLines) * 10);

          if (y - rowHeight < bottomMargin) {
            addPage();
            drawRecordHeader(`Data ${rowIndex + 1} (lanjutan)`);
          }

          drawCell(margin, y, cellWidth, rowHeight, formatColumnLabel(leftKey), leftValue);
          if (rightKey) {
            drawCell(margin + cellWidth + cellGap, y, cellWidth, rowHeight, formatColumnLabel(rightKey), rightValue);
          } else {
            addRect(margin + cellWidth + cellGap, y - rowHeight, cellWidth, rowHeight, '#d7dee8', '#ffffff');
          }
          y -= rowHeight;
        }
        y -= 14;
      });
      y -= 10;
    });

    pages.forEach((page, index) => {
      page.push(`q ${color('#d7dee8')} RG 0.75 w ${margin} 28 m ${pageWidth - margin} 28 l S Q`);
      page.push(`BT ${color('#64748b')} rg /F1 8 Tf 1 0 0 1 ${margin} 16 Tm (${escapePdfText('SiPeNa')}) Tj ET`);
      page.push(`BT ${color('#64748b')} rg /F1 8 Tf 1 0 0 1 ${pageWidth - margin - 65} 16 Tm (${escapePdfText(`Hal. ${index + 1}/${pages.length}`)}) Tj ET`);
    });

    const pageIds: number[] = [];
    const objects: string[] = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '',
      '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    ];
    let nextObjectId = 5;

    pages.forEach((pageOperations) => {
      const pageId = nextObjectId++;
      const contentId = nextObjectId++;
      pageIds.push(pageId);
      const stream = pageOperations.join('\n');
      objects.push(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
      objects.push(`${contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`);
    });

    objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>\nendobj\n`;
    let offset = '%PDF-1.4\n'.length;
    const xref = ['0000000000 65535 f '];
    const body = objects.map((object) => {
      xref.push(`${String(offset).padStart(10, '0')} 00000 n `);
      offset += Buffer.byteLength(object);
      return object;
    }).join('');
    const header = '%PDF-1.4\n';
    const xrefOffset = Buffer.byteLength(header + body);
    const trailer = `xref\n0 ${xref.length}\n${xref.join('\n')}\ntrailer\n<< /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    return Buffer.from(header + body + trailer, 'utf8');
  }

  async exportToExcel(filters: ReportFilters): Promise<Buffer> {
    const sheets = await this.getExportSheets(filters);
    const workbook = new ExcelJS.Workbook();
    sheets.forEach((sheet) => {
      const worksheet = workbook.addWorksheet(sheet.title.slice(0, 31));
      const columns = sheet.columns ?? this.getExportColumns(sheet.rows as RowDataPacket[], filters.reportType);

      worksheet.columns = columns.map((key) => ({
        header: key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
        key,
        width: Math.min(42, Math.max(14, key.length + 8)),
      }));

      sheet.rows.forEach((row) => {
        worksheet.addRow(columns.reduce<Record<string, string | number | Date>>((acc, key) => {
          acc[key] = formatCellValue(row[key]);
          return acc;
        }, {}));
      });

      worksheet.getRow(1).font = { bold: true };
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

export default new ReportService();
