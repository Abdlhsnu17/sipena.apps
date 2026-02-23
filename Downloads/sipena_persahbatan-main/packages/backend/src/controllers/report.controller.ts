import { Request, Response } from 'express';
import { ReportService } from '../services/report.service';

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
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({
          success: false,
          message: 'File laporan wajib diunggah'
        });
        return;
      }

      const userId = (req as any).user?.id;
      const notes = (req.body as any)?.notes as string | undefined;

      const result = await this.reportService.saveUpload(file, userId, notes);
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
  getUploads = async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.reportService.getUploads();
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

      const filePath = this.reportService.getUploadFilePath(record.data.storedPath);
      const fileExists = await this.reportService.fileExists(filePath);

      if (!record.data.storedPath || !fileExists) {
        res.status(404).json({
          success: false,
          message: 'File tidak ditemukan di server'
        });
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
      const result = await this.reportService.deleteUpload(id);
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
