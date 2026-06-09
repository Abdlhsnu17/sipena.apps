import { Request, Response } from 'express';
import { promises as fsPromises } from 'fs';
import { ReportService } from '../services/report.service';
import { recordUserActivity } from '../services/user_activity.service';
import { hasAnyRole, normalizeRole } from '../utils/role';

const getActorUserId = (req: Request): number | null => {
  const parsed = Number(req.user?.id);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const canManageAllUploads = (req: Request): boolean => hasAnyRole(req.user?.role, ['admin', 'leader']);
const isLeaderRole = (req: Request): boolean => normalizeRole(req.user?.role) === 'leader';

const canViewUpload = (req: Request): boolean => getActorUserId(req) !== null;

const canDeleteUpload = (req: Request, ownerId?: number | null): boolean => {
  if (canManageAllUploads(req)) {
    return true;
  }

  const actorId = getActorUserId(req);
  return actorId !== null && ownerId !== null && ownerId !== undefined && actorId === ownerId;
};

const canPreviewInline = (contentType?: string | null): boolean => [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
].includes((contentType || '').toLowerCase());

const reportFileNameLabels: Record<string, string> = {
  assets: 'aset',
  borrowing: 'peminjaman',
  maintenance: 'pemeliharaan',
  usage: 'penggunaan',
  activity: 'aktivitas',
  all: 'terpadu',
};

const normalizeReportTypeForFileName = (value?: string): string => {
  if (value && reportFileNameLabels[value]) {
    return value;
  }
  return 'assets';
};

const sanitizeFileNamePart = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const formatDateForFileName = (value?: string): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : sanitizeFileNamePart(value);
};

const buildReportExportFileName = (
  reportType: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  extension: 'pdf' | 'xlsx' | 'csv',
): string => {
  const normalizedType = normalizeReportTypeForFileName(reportType);
  const typeLabel = reportFileNameLabels[normalizedType];
  const start = formatDateForFileName(startDate);
  const end = formatDateForFileName(endDate);
  const period = start || end ? `${start || 'awal'}-sd-${end || 'akhir'}` : 'semua-data';

  return `laporan-${typeLabel}-${period}.${extension}`;
};

export class ReportController {
  private reportService: ReportService;

  constructor() {
    this.reportService = new ReportService();
  }

  /**
   * Get dashboard statistics
   * GET /api/reports/dashboard
   */
  getDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.reportService.getDashboardStats();
      res.json(result);
    } catch (error) {
      console.error('Get dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get due date notifications
   * GET /api/reports/notifications
   */
  getNotifications = async (_req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.reportService.getDueNotifications();
      res.json({
        success: true,
        message: 'Due notifications retrieved successfully',
        data
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get asset report
   * GET /api/reports/assets
   */
  getAssetReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, category, type } = req.query;

      const result = await this.reportService.getAssetReport({
        startDate: startDate as string,
        endDate: endDate as string,
        category: category as string,
        type: type as string
      });

      res.json(result);
    } catch (error) {
      console.error('Get asset report error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get borrowing report
   * GET /api/reports/borrowing
   */
  getBorrowingReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, status } = req.query;

      const result = await this.reportService.getBorrowingReport({
        startDate: startDate as string,
        endDate: endDate as string,
        status: status as string
      });

      res.json(result);
    } catch (error) {
      console.error('Get borrowing report error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get maintenance report
   * GET /api/reports/maintenance
   */
  getMaintenanceReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, type } = req.query;

      const result = await this.reportService.getMaintenanceReport({
        startDate: startDate as string,
        endDate: endDate as string,
        type: type as string
      });

      res.json(result);
    } catch (error) {
      console.error('Get maintenance report error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get usage report
   * GET /api/reports/usage
   */
  getUsageReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, type, status } = req.query;

      const result = await this.reportService.getUsageReport({
        startDate: startDate as string,
        endDate: endDate as string,
        type: type as string,
        status: status as string
      });

      res.json(result);
    } catch (error) {
      console.error('Get usage report error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Export report to PDF
   * GET /api/reports/export/pdf
   */
  exportPdf = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportType, startDate, endDate, category, type, status, userId } = req.query;

      const pdfBuffer = await this.reportService.exportToPdf({
        reportType: reportType as string,
        startDate: startDate as string,
        endDate: endDate as string,
        category: category as string,
        type: type as string,
        status: status as string,
        userId: userId as string,
        actorUserId: req.user?.id,
        actorRole: req.user?.role
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${buildReportExportFileName(reportType as string, startDate as string, endDate as string, 'pdf')}"`
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Export PDF error:', error);
      res.status(501).json({
        success: false,
        message: error instanceof Error ? error.message : 'Fitur export PDF belum tersedia'
      });
    }
  };

  /**
   * Export report to Excel
   * GET /api/reports/export/excel
   */
  exportExcel = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportType, startDate, endDate, category, type, status, userId } = req.query;

      const excelBuffer = await this.reportService.exportToExcel({
        reportType: reportType as string,
        startDate: startDate as string,
        endDate: endDate as string,
        category: category as string,
        type: type as string,
        status: status as string,
        userId: userId as string,
        actorUserId: req.user?.id,
        actorRole: req.user?.role
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${buildReportExportFileName(reportType as string, startDate as string, endDate as string, 'xlsx')}"`
      );
      res.send(excelBuffer);
    } catch (error) {
      console.error('Export Excel error:', error);
      res.status(501).json({
        success: false,
        message: error instanceof Error ? error.message : 'Fitur export Excel belum tersedia'
      });
    }
  };

  /**
   * GET /api/reports/export/csv
   */
  exportCsv = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportType, startDate, endDate, category, type, status, userId } = req.query;

      const csvBuffer = await this.reportService.exportToCsv({
        reportType: reportType as string,
        startDate: startDate as string,
        endDate: endDate as string,
        category: category as string,
        type: type as string,
        status: status as string,
        userId: userId as string,
        actorUserId: req.user?.id,
        actorRole: req.user?.role
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${buildReportExportFileName(reportType as string, startDate as string, endDate as string, 'csv')}"`
      );
      res.send(csvBuffer);
    } catch (error) {
      console.error('Export CSV error:', error);
      res.status(501).json({
        success: false,
        message: error instanceof Error ? error.message : 'Fitur export CSV belum tersedia'
      });
    }
  };

  /**
   * Upload report file
   * POST /api/reports/uploads
   */
  uploadReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const file = (req.file as Express.Multer.File | undefined);
      if (!file) {
        res.status(400).json({
          success: false,
          message: 'File laporan wajib diunggah'
        });
        return;
      }

      const signature = await this.reportService.validateUploadFileSignature(file);
      if (!signature.valid) {
        await fsPromises.unlink(file.path).catch(() => undefined);
        res.status(400).json({
          success: false,
          message: signature.message || 'File laporan tidak valid'
        });
        return;
      }

      const userId = req.user?.id;
      const notes = (req.body.notes as string | undefined);

      const result = await this.reportService.saveUpload(file, userId, notes);
      const actorId = getActorUserId(req);
      if (actorId && result.success && result.data) {
        await recordUserActivity({
          userId: actorId,
          feature: 'unggahan',
          action: 'upload',
          description: `Mengunggah file ${result.data.filename}`,
          metadata: {
            transactionId: result.data.id,
            transaction_id: result.data.id,
            uploadId: result.data.id,
            sizeBytes: result.data.sizeBytes,
          },
        });
      }
      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      console.error('Upload report error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get uploaded reports
   * GET /api/reports/uploads
   */
  getUploads = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.reportService.getUploads();
      if (!result.success || !result.data) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Get uploads error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Download uploaded report
   * GET /api/reports/uploads/:id/download
   */
  downloadUpload = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const record = await this.reportService.getUploadById(id);

      if (!record.success || !record.data) {
        res.status(404).json({
          success: false,
          message: 'Upload tidak ditemukan'
        });
        return;
      }

      if (!canViewUpload(req)) {
        res.status(403).json({
          success: false,
          message: 'Anda tidak memiliki akses ke file ini'
        });
        return;
      }

      const filePath = this.reportService.getUploadFilePath(record.data.storedPath);
      const fileExists = await this.reportService.fileExists(filePath);

      if (!record.data.storedPath || !fileExists) {
        res.status(404).json({
          success: false,
          message: 'File tidak ditemukan di server'
        });
        return;
      }

      res.download(filePath, record.data.filename);
    } catch (error) {
      console.error('Download upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Preview uploaded report inline
   * GET /api/reports/uploads/:id/preview
   */
  previewUpload = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const record = await this.reportService.getUploadById(id);

      if (!record.success || !record.data) {
        res.status(404).json({
          success: false,
          message: 'Upload tidak ditemukan'
        });
        return;
      }

      if (!canViewUpload(req)) {
        res.status(403).json({
          success: false,
          message: 'Anda tidak memiliki akses ke file ini'
        });
        return;
      }

      const filePath = this.reportService.getUploadFilePath(record.data.storedPath);
      const fileExists = await this.reportService.fileExists(filePath);

      if (!record.data.storedPath || !fileExists) {
        res.status(404).json({
          success: false,
          message: 'File tidak ditemukan di server'
        });
        return;
      }

      if (!canPreviewInline(record.data.contentType)) {
        res.download(filePath, record.data.filename);
        return;
      }

      res.setHeader('Content-Type', record.data.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${record.data.filename}"`);
      res.sendFile(filePath);
    } catch (error) {
      console.error('Preview upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Delete uploaded report
   * DELETE /api/reports/uploads/:id
   */
  deleteUpload = async (req: Request, res: Response): Promise<void> => {
    try {
      if (isLeaderRole(req)) {
        res.status(403).json({
          success: false,
          message: 'Role leader tidak dapat menghapus unggahan'
        });
        return;
      }

      const { id } = req.params;
      const existing = await this.reportService.getUploadById(id);
      if (!existing.success || !existing.data) {
        res.status(404).json(existing);
        return;
      }

      if (!canDeleteUpload(req, existing.data.userId)) {
        res.status(403).json({
          success: false,
          message: 'Anda tidak memiliki akses untuk menghapus file ini'
        });
        return;
      }

      const result = await this.reportService.deleteUpload(id);
      const actorId = getActorUserId(req);
      if (actorId && result.success) {
        await recordUserActivity({
          userId: actorId,
          feature: 'unggahan',
          action: 'delete',
          description: `Menghapus unggahan ${existing.data?.filename || `#${id}`}`,
          metadata: {
            transactionId: existing.data?.id ? Number(existing.data.id) : Number(id),
            transaction_id: existing.data?.id ? Number(existing.data.id) : Number(id),
            uploadId: existing.data?.id ? Number(existing.data.id) : Number(id),
          },
        });
      }
      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      console.error('Delete upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}

export default new ReportController();
