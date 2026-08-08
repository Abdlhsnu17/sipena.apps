import { Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import deletionRequestService from '../services/deletion-request.service';
import { createScopedLogger } from '../utils/logger';
import { validateRequest } from '../middlewares/validate-request.middleware';

const logger = createScopedLogger('controller:deletion_request');

const getActorUserId = (req: Request): number | null => {
  const parsed = Number(req.user?.id);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

class DeletionRequestController {
  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await deletionRequestService.getAll({
        status: req.query.status as string | undefined,
        targetType: req.query.targetType as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Get deletion requests error', { error });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const actorId = getActorUserId(req);
      if (!actorId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const result = await deletionRequestService.create({
        targetType: req.body.targetType,
        targetId: Number(req.body.targetId),
        targetLabel: req.body.targetLabel,
        reason: req.body.reason,
        requestedBy: actorId,
      });
      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      logger.error('Create deletion request error', { error });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  approve = async (req: Request, res: Response): Promise<void> => {
    try {
      const actorId = getActorUserId(req);
      if (!actorId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const result = await deletionRequestService.approve(Number(req.params.id), {
        reviewedBy: actorId,
        reviewNotes: req.body.reviewNotes,
      });
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Approve deletion request error', { error });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  reject = async (req: Request, res: Response): Promise<void> => {
    try {
      const actorId = getActorUserId(req);
      if (!actorId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const result = await deletionRequestService.reject(Number(req.params.id), {
        reviewedBy: actorId,
        reviewNotes: req.body.reviewNotes,
      });
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Reject deletion request error', { error });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
}

export const deletionRequestValidators = {
  getAll: [
    query('status').optional().isIn(['pending', 'approved', 'rejected']),
    query('targetType').optional().isIn(['user', 'borrowing', 'return', 'maintenance']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validateRequest
  ],
  create: [
    body('targetType').isIn(['user', 'borrowing', 'return', 'maintenance']),
    body('targetId').isInt({ min: 1 }).toInt(),
    body('targetLabel').optional().trim(),
    body('reason').trim().notEmpty().withMessage('Alasan penghapusan wajib diisi'),
    validateRequest
  ],
  review: [
    param('id').isInt({ min: 1 }),
    body('reviewNotes').optional().trim(),
    validateRequest
  ],
};

export default new DeletionRequestController();
