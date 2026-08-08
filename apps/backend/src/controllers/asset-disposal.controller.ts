import { Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import disposalService from '../services/asset-disposal.service';
import { createScopedLogger } from '../utils/logger';
import { validateRequest } from '../middlewares/validate-request.middleware';

const logger = createScopedLogger('controller:asset-disposal');

const getAuthenticatedUserId = (req: Request): number | null => {
  const userId = Number(req.user?.id);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
};

class AssetDisposalController {
  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await disposalService.getAll({
        status: req.query.status as string | undefined,
        assetType: req.query.assetType as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Get disposal requests error', { error });
      res.status(500).json({ success: false, message: 'Gagal mengambil data permintaan penghapusan' });
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await disposalService.getById(Number(req.params.id));
      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      logger.error('Get disposal request error', { error });
      res.status(500).json({ success: false, message: 'Gagal mengambil data permintaan penghapusan' });
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const requestedBy = getAuthenticatedUserId(req);
      if (!requestedBy) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const result = await disposalService.create({
        ...req.body,
        requestedBy,
      });
      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      logger.error('Create disposal request error', { error });
      res.status(500).json({ success: false, message: 'Gagal membuat permintaan penghapusan' });
    }
  };

  approve = async (req: Request, res: Response): Promise<void> => {
    try {
      const reviewedBy = getAuthenticatedUserId(req);
      if (!reviewedBy) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const result = await disposalService.approve(Number(req.params.id), {
        reviewedBy,
        reviewNotes: req.body.reviewNotes,
      });
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Approve disposal request error', { error });
      res.status(500).json({ success: false, message: 'Gagal menyetujui permintaan penghapusan' });
    }
  };

  reject = async (req: Request, res: Response): Promise<void> => {
    try {
      const reviewedBy = getAuthenticatedUserId(req);
      if (!reviewedBy) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const result = await disposalService.reject(Number(req.params.id), {
        reviewedBy,
        reviewNotes: req.body.reviewNotes,
      });
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Reject disposal request error', { error });
      res.status(500).json({ success: false, message: 'Gagal menolak permintaan penghapusan' });
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await disposalService.delete(Number(req.params.id));
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Delete disposal request error', { error });
      res.status(500).json({ success: false, message: 'Gagal membatalkan permintaan penghapusan' });
    }
  };
}

export const disposalValidators = {
  getAll: [
    query('status').optional().isIn(['pending', 'approved', 'rejected']),
    query('assetType').optional().isIn(['medical', 'non_medical']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validateRequest
  ],
  getById: [param('id').isInt({ min: 1 }), validateRequest],
  create: [
    body('assetId').isInt({ min: 1 }),
    body('assetType').isIn(['medical', 'non_medical']),
    body('assetDetailId').optional().trim(),
    body('assetDetailName').optional().trim(),
    body('assetDetailCode').optional().trim(),
    body('reason').trim().notEmpty().withMessage('Alasan penghapusan wajib diisi'),
    body('conditionNotes').optional().trim(),
    validateRequest
  ],
  review: [
    param('id').isInt({ min: 1 }),
    body('reviewNotes').optional().trim(),
    validateRequest
  ],
};

export default new AssetDisposalController();
