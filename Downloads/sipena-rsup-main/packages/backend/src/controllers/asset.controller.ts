import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AssetService } from '../services/asset.service';

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
      console.error('Get assets error:', error);
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
      console.error('Get asset error:', error);
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
      console.error('Create asset error:', error);
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
      console.error('Update asset error:', error);
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
      console.error('Delete asset error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}

export default new AssetController();
