import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { requireRole } from '../middlewares/authMiddleware';
import borrowingController from '../controllers/borrowing.controller';

const router = Router();

const BORROWING_STATUSES = ['pending', 'approved', 'rejected', 'borrowed', 'returned', 'overdue'];

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1 }).toInt(),
    query('status').optional().isIn(BORROWING_STATUSES),
    query('userId').optional().isInt({ min: 1 }).toInt(),
    query('assetId').optional().isInt({ min: 1 }).toInt(),
    query('assetType').optional().isIn(['medical', 'non_medical'])
  ],
  borrowingController.getAll
);

router.get('/:id', [param('id').isInt({ min: 1 })], borrowingController.getById);

router.post(
  '/',
  [
    body('assetId').isInt({ min: 1 }),
    body('assetType').optional().isIn(['medical', 'non_medical']),
    body('assetDetailId').optional().trim(),
    body('assetDetailName').optional().trim(),
    body('assetDetailCode').optional().trim(),
    body('borrowDate').isISO8601(),
    body('dueDate').optional().isISO8601(),
    body('purpose').trim().notEmpty(),
    body('notes').optional().trim()
  ],
  borrowingController.create
);

router.patch(
  '/:id',
  requireRole(['admin', 'leader']),
  [
    param('id').isInt({ min: 1 }),
    body('borrowDate').optional().isISO8601(),
    body('dueDate').optional().isISO8601(),
    body('purpose').optional().trim(),
    body('notes').optional().trim(),
    body('returnCondition').optional().trim(),
    body('returnNotes').optional().trim()
  ],
  borrowingController.update
);

router.patch('/:id/approve', [param('id').isInt({ min: 1 })], borrowingController.approve);

router.patch(
  '/:id/reject',
  [
    param('id').isInt({ min: 1 }),
    body('reason').trim().notEmpty()
  ],
  borrowingController.reject
);

router.patch(
  '/:id/return',
  [
    param('id').isInt({ min: 1 }),
    body('condition').trim().notEmpty()
  ],
  borrowingController.return
);

router.patch(
  '/:id/validate-return',
  [param('id').isInt({ min: 1 })],
  requireRole(['admin', 'leader']),
  borrowingController.validateReturn
);

router.delete('/:id', [param('id').isInt({ min: 1 })], borrowingController.delete);

export default router;
