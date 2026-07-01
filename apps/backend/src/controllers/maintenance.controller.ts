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
        view,
        status,
        assetId,
        assetType,
        type
      } = req.query;

      const result = await this.maintenanceService.getAll({
        page: Number(page),
        limit: Number(limit),
        view: view as 'active' | 'history' | undefined,
        status: status as string,
        assetId: assetId as string,
        assetType: normalizeAssetType(assetType),
        type: type as string,
        actorUserId: getActorUserId(req),
        actorRole: req.user?.role,
        actorWorkUnit: req.user?.workUnit
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

      if (
        req.body.status === 'cancelled' &&
        !String(req.body.cancellationReason || '').trim()
      ) {
        res.status(400).json({
          success: false,
          message: 'Alasan pembatalan wajib diisi saat status dibatalkan'
        });
        return;
      }

      const result = await this.maintenanceService.create({
        ...req.body,
        createdBy
      });

      const actorId = getActorUserId(req);
      if (actorId && result.success && result.data) {
        const maintenanceCode = result.data.maintenanceCode || undefined;
        await recordUserActivity({
          userId: actorId,
          feature: 'jadwal_pemeliharaan',
          action: 'create',
          description: `Membuat jadwal pemeliharaan ${maintenanceCode || `#${result.data.id}`}`,
          metadata: {
            transactionId: maintenanceCode ?? result.data.id,
            transaction_id: maintenanceCode ?? result.data.id,
            maintenanceCode,
            maintenance_code: maintenanceCode,
            maintenanceId: result.data.id,
            assetId: result.data.assetId,
            assetCode: result.data.assetCode,
            assetName: result.data.assetName,
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
      const isAdmin = hasAnyRole(requesterRole, ['admin']);
      const actorId = getActorUserId(req);

      const existingResult = await this.maintenanceService.getById(id);
      if (!existingResult.success || !existingResult.data) {
        res.status(404).json(existingResult);
        return;
      }

      const existingStatus = existingResult.data.status;
      if (existingStatus === 'validated' && !isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Pemeliharaan yang sudah selesai final tidak bisa diedit selain oleh admin'
        });
        return;
      }

      if (req.body.status === 'validated' && !canManageMaintenanceCompletion(requesterRole)) {
        res.status(403).json({
          success: false,
          message: 'Hanya admin, leader, atau teknisi yang dapat melakukan validasi akhir pemeliharaan'
        });
        return;
      }

      if (req.body.status === 'validated') {
        if (existingStatus === 'validated') {
          res.status(400).json({
            success: false,
            message: 'Pemeliharaan yang sudah selesai final tidak dapat diajukan validasi ulang'
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

        const validateResult = await this.maintenanceService.validate(id, actorId, new Date());
        if (!validateResult.success) {
          res.status(400).json(validateResult);
          return;
        }

        if (validateResult.data) {
          const maintenanceCode = validateResult.data.maintenanceCode || undefined;
          await recordUserActivity({
            userId: actorId,
            feature: 'pemeliharaan',
            action: 'validate',
            description: `Memvalidasi pemeliharaan ${maintenanceCode || `#${validateResult.data.id}`}`,
            metadata: {
              transactionId: maintenanceCode ?? validateResult.data.id,
              transaction_id: maintenanceCode ?? validateResult.data.id,
              maintenanceCode,
              maintenance_code: maintenanceCode,
              maintenanceId: validateResult.data.id,
              assetCode: validateResult.data.assetCode,
              assetName: validateResult.data.assetName,
              status: validateResult.data.status,
            },
          });
        }

        res.json(validateResult);
        return;
      }

      if (req.body.status === 'cancelled' && !canManageMaintenanceCompletion(requesterRole)) {
        res.status(403).json({
          success: false,
          message: 'Hanya admin, leader, atau teknisi yang dapat membatalkan pemeliharaan'
        });
        return;
      }

      if (
        req.body.status === 'cancelled' &&
        !String(req.body.cancellationReason || '').trim()
      ) {
        res.status(400).json({
          success: false,
          message: 'Alasan pembatalan wajib diisi saat status dibatalkan'
        });
        return;
      }

      if (req.body.status === 'completed') {
        if (!canManageMaintenanceCompletion(requesterRole)) {
          res.status(403).json({
            success: false,
            message: 'Hanya admin, leader, atau teknisi yang dapat menandai perbaikan selesai dan mengirimkannya ke validasi akhir'
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
          const maintenanceCode = completeResult.data.maintenanceCode || undefined;
          await recordUserActivity({
            userId: actorId,
            feature: 'pemeliharaan',
            action: 'complete',
            description: `Menandai pemeliharaan selesai perbaikan ${maintenanceCode || `#${completeResult.data.id}`}`,
            metadata: {
              transactionId: maintenanceCode ?? completeResult.data.id,
              transaction_id: maintenanceCode ?? completeResult.data.id,
              maintenanceCode,
              maintenance_code: maintenanceCode,
              maintenanceId: completeResult.data.id,
              assetCode: completeResult.data.assetCode,
              assetName: completeResult.data.assetName,
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
        const maintenanceCode = result.data.maintenanceCode || undefined;
        await recordUserActivity({
          userId: actorId,
          feature: 'jadwal_pemeliharaan',
          action: 'update',
          description: `Mengubah jadwal pemeliharaan ${maintenanceCode || `#${result.data.id}`}`,
          metadata: {
            transactionId: maintenanceCode ?? result.data.id,
            transaction_id: maintenanceCode ?? result.data.id,
            maintenanceCode,
            maintenance_code: maintenanceCode,
            maintenanceId: result.data.id,
            assetCode: result.data.assetCode,
            assetName: result.data.assetName,
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
        const maintenanceCode = result.data.maintenanceCode || undefined;
        await recordUserActivity({
          userId: actorId,
          feature: 'pemeliharaan',
          action: 'complete',
          description: `Menandai pemeliharaan selesai perbaikan ${maintenanceCode || `#${result.data.id}`}`,
          metadata: {
            transactionId: maintenanceCode ?? result.data.id,
            transaction_id: maintenanceCode ?? result.data.id,
            maintenanceCode,
            maintenance_code: maintenanceCode,
            maintenanceId: result.data.id,
            assetCode: result.data.assetCode,
            assetName: result.data.assetName,
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
      const actorId = getActorUserId(req);
      const deleteReason = typeof req.body?.deleteReason === 'string'
        ? req.body.deleteReason.trim()
        : undefined;
      if (!deleteReason) {
        res.status(400).json({ success: false, message: 'Alasan penghapusan wajib diisi' });
        return;
      }
      const result = await this.maintenanceService.delete(id, actorId ?? undefined, deleteReason);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      if (actorId) {
        const maintenanceCode = beforeDelete.data?.maintenanceCode || undefined;
        await recordUserActivity({
          userId: actorId,
          feature: 'jadwal_pemeliharaan',
          action: 'delete',
          description: `Mengarsipkan riwayat pemeliharaan ${maintenanceCode || `#${id}`}`,
          metadata: {
            transactionId: maintenanceCode ?? beforeDelete.data?.id ?? Number(id),
            transaction_id: maintenanceCode ?? beforeDelete.data?.id ?? Number(id),
            maintenanceCode,
            maintenance_code: maintenanceCode,
            maintenanceId: beforeDelete.data?.id ? Number(beforeDelete.data.id) : Number(id),
            assetCode: beforeDelete.data?.assetCode,
            assetName: beforeDelete.data?.assetName,
            deleteReason,
            delete_reason: deleteReason,
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
