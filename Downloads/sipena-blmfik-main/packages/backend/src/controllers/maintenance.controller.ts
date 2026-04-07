import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AssetType } from '../models';
import { MaintenanceService } from '../services/maintenance.service';
import { recordUserActivity } from '../services/user_activity.service';
import { canManageMaintenanceCompletion, hasAnyRole } from '../utils/role';

const getActorUserId = (req: Request): number | null => {
  const parsed = Number(req.user?.id);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeAssetType = (value: unknown): AssetType | undefined => {
  if (value === 'medical' || value === 'non_medical') {
    return value;
  }

  return undefined;
};

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
        assetType: normalizeAssetType(assetType),
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

      const createdBy = getActorUserId(req);
      if (!createdBy) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const result = await this.maintenanceService.create({
        ...req.body,
        createdBy
      });

      const actorId = getActorUserId(req);
      if (actorId && result.success && result.data) {
        await recordUserActivity({
          userId: actorId,
          feature: 'jadwal_pemeliharaan',
          action: 'create',
          description: `Membuat jadwal pemeliharaan ${result.data.maintenanceCode || `#${result.data.id}`}`,
          metadata: {
            maintenanceId: result.data.id,
            assetId: result.data.assetId,
            status: result.data.status,
          },
        });
      }

      res.status(201).json(result);
    } catch (error) {
      console.error('Create maintenance error:', error);
      console.error('Error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: (error as Error).message
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
      const requester = req.user;
      const requesterRole = requester?.role;
      const actorId = getActorUserId(req);

      if (req.body.status === 'validated' && !hasAnyRole(requesterRole, ['admin', 'leader'])) {
        res.status(403).json({
          success: false,
          message: 'Hanya admin atau leader yang dapat memvalidasi pemeliharaan'
        });
        return;
      }

      if (req.body.status === 'cancelled' && !canManageMaintenanceCompletion(requesterRole)) {
        res.status(403).json({
          success: false,
          message: 'Hanya admin, leader, atau teknisi yang dapat membatalkan pemeliharaan'
        });
        return;
      }

      if (req.body.status === 'completed') {
        if (!canManageMaintenanceCompletion(requesterRole)) {
          res.status(403).json({
            success: false,
            message: 'Hanya admin, leader, atau teknisi yang dapat menandai pemeliharaan sebagai selesai'
          });
          return;
        }

        if (!actorId) {
          res.status(401).json({
            success: false,
            message: 'User not authenticated'
          });
          return;
        }

        const completeResult = await this.maintenanceService.complete(id, {
          notes: req.body.notes,
          cost: req.body.cost,
          completedBy: actorId
        });

        if (!completeResult.success) {
          res.status(404).json(completeResult);
          return;
        }

        if (actorId && completeResult.data) {
          await recordUserActivity({
            userId: actorId,
            feature: 'pemeliharaan',
            action: 'complete',
            description: `Menyelesaikan pemeliharaan ${completeResult.data.maintenanceCode || `#${completeResult.data.id}`}`,
            metadata: {
              maintenanceId: completeResult.data.id,
              status: completeResult.data.status,
            },
          });
        }

        res.json(completeResult);
        return;
      }

      const result = await this.maintenanceService.update(id, req.body);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      if (actorId && result.data) {
        await recordUserActivity({
          userId: actorId,
          feature: 'jadwal_pemeliharaan',
          action: 'update',
          description: `Mengubah jadwal pemeliharaan ${result.data.maintenanceCode || `#${result.data.id}`}`,
          metadata: {
            maintenanceId: result.data.id,
            status: result.data.status,
          },
        });
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
      const completedBy = getActorUserId(req);
      const actorId = getActorUserId(req);

      if (!completedBy) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const result = await this.maintenanceService.complete(id, {
        notes,
        cost,
        completedBy
      });

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      if (actorId && result.data) {
        await recordUserActivity({
          userId: actorId,
          feature: 'pemeliharaan',
          action: 'complete',
          description: `Menyelesaikan pemeliharaan ${result.data.maintenanceCode || `#${result.data.id}`}`,
          metadata: {
            maintenanceId: result.data.id,
            status: result.data.status,
          },
        });
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
      const beforeDelete = await this.maintenanceService.getById(id);
      const result = await this.maintenanceService.delete(id);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      const actorId = getActorUserId(req);
      if (actorId) {
        await recordUserActivity({
          userId: actorId,
          feature: 'jadwal_pemeliharaan',
          action: 'delete',
          description: `Menghapus jadwal pemeliharaan ${beforeDelete.data?.maintenanceCode || `#${id}`}`,
          metadata: {
            maintenanceId: beforeDelete.data?.id ? Number(beforeDelete.data.id) : Number(id),
          },
        });
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
