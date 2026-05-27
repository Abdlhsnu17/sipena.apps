import ExcelJS from 'exceljs';
import fs, { promises as fsPromises } from 'fs';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import path from 'path';
import pool from '../config/database';
import { ApiResponse } from '../models';
import { getReportUploadsDir } from '../utils/storage-paths';

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

const normalizeExportType = (value?: string): 'assets' | 'borrowing' | 'maintenance' | 'usage' | 'all' => {
  if (value === 'borrowing' || value === 'maintenance' || value === 'usage' || value === 'all') return value;
  return 'assets';
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

    const [summaryRows, assetResult, borrowingResult, maintenanceResult, usageResult, uploadResult] = await Promise.all([
      this.getDashboardSummaryRows(),
      this.getAssetReport(filters),
      this.getBorrowingReport(filters),
      this.getMaintenanceReport(filters),
      this.getUsageReport(filters),
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
      'condition_before',
      'condition_after',
      'condition',
      'location',
      'user_name',
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
      default:
        return ['id', 'asset_code', 'name', 'category', 'type', 'status', 'location'];
    }
  }

  async exportToPdf(filters: ReportFilters): Promise<Buffer> {
    const sheets = await this.getExportSheets(filters);
    const title = this.getExportTitle(filters.reportType);
    const lines = [title, `Dibuat: ${new Date().toLocaleString('id-ID')}`];

    sheets.forEach((sheet) => {
      lines.push('', sheet.title, `Total data: ${sheet.rows.length}`);
      const columns = (sheet.columns ?? this.getExportColumns(sheet.rows as RowDataPacket[], filters.reportType)).slice(0, 6);
      lines.push(columns.join(' | '));
      lines.push(
        ...sheet.rows.map((row) =>
          columns
            .map((key) => String(formatCellValue(row[key])).replace(/\s+/g, ' ').slice(0, 32))
            .join(' | ')
        )
      );
    });

    const pdfLines = lines.flatMap((line) => {
      if (line.length <= 110) return [line];
      const chunks: string[] = [];
      for (let index = 0; index < line.length; index += 110) {
        chunks.push(line.slice(index, index + 110));
      }
      return chunks;
    });
    const pageLineLimit = 56;
    const pageChunks: string[][] = [];
    for (let index = 0; index < pdfLines.length; index += pageLineLimit) {
      pageChunks.push(pdfLines.slice(index, index + pageLineLimit));
    }

    const pageIds: number[] = [];
    const objects: string[] = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '',
      '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    ];
    let nextObjectId = 4;

    pageChunks.forEach((pageLines) => {
      const pageId = nextObjectId++;
      const contentId = nextObjectId++;
      pageIds.push(pageId);
      const content = ['BT', '/F1 9 Tf', '40 790 Td'];
      pageLines.forEach((line, index) => {
        if (index > 0) content.push('0 -13 Td');
        content.push(`(${escapePdfText(line)}) Tj`);
      });
      content.push('ET');
      const stream = content.join('\n');
      objects.push(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
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
