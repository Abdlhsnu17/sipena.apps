import { Request, Response } from 'express';
import { ReportService } from '../services/report.service';
import { recordUserActivity } from '../services/user_activity.service';
import { hasAnyRole } from '../utils/role';

const getActorUserId = (req: Request): number | null => {
  const parsed = Number(req.user?.id);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const canManageAllUploads = (req: Request): boolean => hasAnyRole(req.user?.role, ['admin', 'leader']);

const canAccessUpload = (req: Request, ownerId?: number | null): boolean => {
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
   * Export report to PDF
   * GET /api/reports/export/pdf
   */
  exportPdf = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportType, startDate, endDate } = req.query;

      const pdfBuffer = await this.reportService.exportToPdf({
        reportType: reportType as string,
        startDate: startDate as string,
        endDate: endDate as string
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=report-${Date.now()}.pdf`);
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
      const { reportType, startDate, endDate } = req.query;

      const excelBuffer = await this.reportService.exportToExcel({
        reportType: reportType as string,
        startDate: startDate as string,
        endDate: endDate as string
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=report-${Date.now()}.xlsx`);
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

      if (!canManageAllUploads(req)) {
        const actorId = getActorUserId(req);
        result.data = result.data.filter((upload) => actorId !== null && upload.userId === actorId);
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

      if (!canAccessUpload(req, record.data.userId)) {
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

      if (!canAccessUpload(req, record.data.userId)) {
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
      const { id } = req.params;
      const existing = await this.reportService.getUploadById(id);
      if (!existing.success || !existing.data) {
        res.status(404).json(existing);
        return;
      }

      if (!canAccessUpload(req, existing.data.userId)) {
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
