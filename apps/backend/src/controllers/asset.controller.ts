import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { importAssetsFromBuffer, generateImportTemplate } from '../services/asset_import.service';
import { AssetService } from '../services/asset.service';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('controller:asset');

export class AssetController {
  private assetService: AssetService;

  constructor() {
    this.assetService = new AssetService();
  }

  /**
   * Get all assets with pagination and filters
   * GET /api/assets
   */
  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        category,
        status,
        type
      } = req.query;

      const result = await this.assetService.getAll({
        page: Number(page),
        limit: Number(limit),
        search: search as string,
        category: category as string,
        status: status as string,
        type: type as string
      });

      res.json(result);
    } catch (error) {
      logger.error('Get assets error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get asset by ID
   * GET /api/assets/:id
   */
  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { type = 'medical' } = req.query;
      const result = await this.assetService.getById(id, type as string);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Get asset error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Create new asset
   * POST /api/assets
   */
  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const result = await this.assetService.create(req.body);
      res.status(201).json(result);
    } catch (error) {
      logger.error('Create asset error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Update asset
   * PUT /api/assets/:id
   */
  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const { type = 'medical' } = req.body;
      const result = await this.assetService.update(id, req.body, type);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Update asset error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Delete asset
   * DELETE /api/assets/:id
   */
  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { type = 'medical' } = req.query;
      const result = await this.assetService.delete(id, type as string);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Delete asset error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Reset all inventory data without deleting users.
   * DELETE /api/assets/reset/all
   */
  resetInventory = async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.assetService.resetInventory();
      res.json(result);
    } catch (error) {
      logger.error('Reset inventory error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  importFromFile = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'File tidak ditemukan. Unggah file Excel (.xlsx).' });
        return;
      }

      const assetType = (req.query.type as string) === 'non_medical' ? 'non_medical' : 'medical';
      const createdBy = Number(req.user?.id) || 0;

      const result = await importAssetsFromBuffer(req.file.buffer, assetType, createdBy);

      res.json({
        success: true,
        message: `Import selesai: ${result.success} berhasil, ${result.failed} gagal`,
        data: result,
      });
    } catch (error) {
      logger.error('Import assets error', { error });
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Gagal mengimpor aset',
      });
    }
  };

  downloadTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const assetType = (req.query.type as string) === 'non_medical' ? 'non_medical' : 'medical';
      const wb = generateImportTemplate(assetType);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="template-import-${assetType}.xlsx"`);
      await wb.xlsx.write(res);
      res.end();
    } catch (error) {
      logger.error('Download template error', { error });
      res.status(500).json({ success: false, message: 'Gagal mengunduh template' });
    }
  };
}

export default new AssetController();
