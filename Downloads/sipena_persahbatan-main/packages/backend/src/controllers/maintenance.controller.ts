import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { MaintenanceService } from '../services/maintenance.service';

export class MaintenanceController {
  private maintenanceService: MaintenanceService;

  constructor() {
    this.maintenanceService = new MaintenanceService();
  }

  /**
   * Get all maintenance records
   * GET /api/maintenance
   */
  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        assetId,
        assetType,
        type
      } = req.query;

      const result = await this.maintenanceService.getAll({
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        assetId: assetId as string,
        assetType: assetType as any,
        type: type as string
      });

      res.json(result);
    } catch (error) {
      console.error('Get maintenance records error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get maintenance by ID
   * GET /api/maintenance/:id
   */
  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.maintenanceService.getById(id);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Get maintenance error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Create new maintenance record
   * POST /api/maintenance
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

      const createdBy = (req as any).user?.id;
      const result = await this.maintenanceService.create({
        ...req.body,
        createdBy
      });

      res.status(201).json(result);
    } catch (error) {
      console.error('Create maintenance error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Update maintenance record
   * PUT /api/maintenance/:id
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
      const requester = (req as any).user;
      const requesterRole = requester?.role;

      if (req.body.status === 'completed') {
        if (!['admin', 'leader'].includes(requesterRole)) {
          res.status(403).json({
            success: false,
            message: 'Hanya admin atau leader yang dapat memvalidasi pemeliharaan sebagai selesai'
          });
          return;
        }

        const completeResult = await this.maintenanceService.complete(id, {
          notes: req.body.notes,
          cost: req.body.cost,
          completedBy: requester?.id
        });

        if (!completeResult.success) {
          res.status(404).json(completeResult);
          return;
        }

        res.json(completeResult);
        return;
      }

      const result = await this.maintenanceService.update(id, req.body);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Update maintenance error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Complete maintenance
   * PATCH /api/maintenance/:id/complete
   */
  complete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { notes, cost } = req.body;
      const completedBy = (req as any).user?.id;

      const result = await this.maintenanceService.complete(id, {
        notes,
        cost,
        completedBy
      });

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Complete maintenance error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Delete maintenance record
   * DELETE /api/maintenance/:id
   */
  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.maintenanceService.delete(id);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Delete maintenance error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}

export default new MaintenanceController();
