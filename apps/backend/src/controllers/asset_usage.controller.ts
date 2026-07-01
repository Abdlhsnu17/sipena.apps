import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AssetType } from '../models';
import { AssetUsageService } from '../services/asset_usage.service';
import { recordUserActivity } from '../services/user_activity.service';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('controller:asset-usage');

const getActorUserId = (req: Request): number | null => {
  const parsed = Number(req.user?.id);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeAssetType = (value: unknown): AssetType | undefined => {
  if (value === 'medical' || value === 'non_medical') return value;
  return undefined;
};

export class AssetUsageController {
  private assetUsageService: AssetUsageService;

  constructor() {
    this.assetUsageService = new AssetUsageService();
  }

  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        assetId,
        assetType,
        roomName,
        usageContext,
        dateFrom,
        dateTo
      } = req.query;

      const result = await this.assetUsageService.getAll({
        page: Number(page),
        limit: Number(limit),
        assetId: assetId as string,
        assetType: normalizeAssetType(assetType),
        roomName: roomName as string,
        usageContext: usageContext as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string
      });

      res.json(result);
    } catch (error) {
      logger.error('Get asset usage logs error', { error });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.assetUsageService.getById(req.params.id);
      if (!result.success) {
        res.status(404).json(result);
        return;
      }
      res.json(result);
    } catch (error) {
      logger.error('Get asset usage log error', { error });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
        return;
      }

      const actorId = getActorUserId(req);
      if (!actorId) {
        res.status(401).json({ success: false, message: 'User not authenticated' });
        return;
      }

      const result = await this.assetUsageService.create({ ...req.body, createdBy: actorId, actorRole: req.user?.role });
      if (result.success && result.data) {
        await recordUserActivity({
          userId: actorId,
          feature: 'penggunaan_alat',
          action: 'create',
          description: `Mencatat penggunaan alat ${result.data.assetDetailCode || result.data.assetCode || result.data.id}`,
          metadata: {
            usageId: result.data.id,
            assetId: result.data.assetId,
            assetType: result.data.assetType,
            assetCode: result.data.assetDetailCode || result.data.assetCode,
            assetName: result.data.assetDetailName || result.data.assetName,
            roomName: result.data.roomName,
            usageCount: result.data.usageCount
          }
        });
      }

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      logger.error('Create asset usage log error', { error });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
        return;
      }

      const actorId = getActorUserId(req);
      const result = await this.assetUsageService.update(req.params.id, {
        ...req.body,
        actorId: actorId ?? undefined,
        actorRole: req.user?.role,
      });

      if (result.success && result.data && actorId) {
        await recordUserActivity({
          userId: actorId,
          feature: 'penggunaan_alat',
          action: 'update',
          description: `Mengubah penggunaan alat ${result.data.assetDetailCode || result.data.assetCode || result.data.id}`,
          metadata: {
            usageId: result.data.id,
            assetId: result.data.assetId,
            assetType: result.data.assetType,
            assetCode: result.data.assetDetailCode || result.data.assetCode,
            assetName: result.data.assetDetailName || result.data.assetName,
            roomName: result.data.roomName,
            usageCount: result.data.usageCount
          }
        });
      }

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Update asset usage log error', { error });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const actorId = getActorUserId(req);
      const existing = await this.assetUsageService.getById(req.params.id);
      const result = await this.assetUsageService.delete(req.params.id, actorId ?? undefined, req.body?.deleteReason);

      if (result.success && existing.data && actorId) {
        await recordUserActivity({
          userId: actorId,
          feature: 'penggunaan_alat',
          action: 'delete',
          description: `Mengarsipkan penggunaan alat ${existing.data.assetDetailCode || existing.data.assetCode || existing.data.id}`,
          metadata: {
            usageId: existing.data.id,
            assetId: existing.data.assetId,
            assetType: existing.data.assetType,
            assetCode: existing.data.assetDetailCode || existing.data.assetCode,
            assetName: existing.data.assetDetailName || existing.data.assetName,
            roomName: existing.data.roomName,
            deleteReason: req.body?.deleteReason || undefined
          }
        });
      }

      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      logger.error('Delete asset usage log error', { error });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
}

export default new AssetUsageController();
