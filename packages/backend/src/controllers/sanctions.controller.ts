import { Request, Response } from 'express';
import { param, body, query, validationResult } from 'express-validator';
import sanctionsService from '../services/sanctions.service';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('controller:sanctions');

const getAuthenticatedUserId = (req: Request): number | null => {
  const userId = Number(req.user?.id);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
};

class SanctionsController {
  getAll = async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, message: 'Validasi gagal', errors: errors.array() });
      return;
    }
    try {
      const status = (req.query.status as string) || 'active';
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const result = await sanctionsService.getAll({ status: status as any, userId, page, limit });
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Get sanctions error', { error });
      res.status(500).json({ success: false, message: 'Gagal mengambil data sanksi' });
    }
  };

  getStats = async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await sanctionsService.getStats();
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Get sanctions stats error', { error });
      res.status(500).json({ success: false, message: 'Gagal mengambil statistik sanksi' });
    }
  };

  resolve = async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, message: 'Validasi gagal', errors: errors.array() });
      return;
    }
    try {
      const borrowingId = Number(req.params.id);
      const resolvedByUserId = getAuthenticatedUserId(req);
      if (!resolvedByUserId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }
      const { notes } = req.body;
      const result = await sanctionsService.resolve(borrowingId, resolvedByUserId, notes);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Resolve sanction error', { error });
      res.status(500).json({ success: false, message: 'Gagal menyelesaikan sanksi' });
    }
  };

  waive = async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, message: 'Validasi gagal', errors: errors.array() });
      return;
    }
    try {
      const borrowingId = Number(req.params.id);
      const resolvedByUserId = getAuthenticatedUserId(req);
      if (!resolvedByUserId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }
      const { reason } = req.body;
      const result = await sanctionsService.waive(borrowingId, resolvedByUserId, reason);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Waive sanction error', { error });
      res.status(500).json({ success: false, message: 'Gagal membebaskan sanksi' });
    }
  };
}

export const sanctionsValidators = {
  getAll: [
    query('status').optional().isIn(['active', 'resolved', 'all']),
    query('userId').optional().isInt({ min: 1 }).toInt(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  resolve: [
    param('id').isInt({ min: 1 }),
    body('notes').optional().trim(),
  ],
  waive: [
    param('id').isInt({ min: 1 }),
    body('reason').trim().notEmpty().withMessage('Alasan pembebasan sanksi wajib diisi'),
  ],
};

export default new SanctionsController();
