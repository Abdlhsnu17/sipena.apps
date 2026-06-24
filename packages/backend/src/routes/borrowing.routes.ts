import { Router } from 'express';
import { body, param, query } from 'express-validator';
import borrowingController from '../controllers/borrowing.controller';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

const BORROWING_STATUSES = ['pending', 'approved', 'rejected', 'borrowed', 'returned', 'overdue'];
const BORROWING_ACCESS_ROLES = ['admin', 'leader', 'staff', 'staff_pj', 'staff pj', 'user'];
const BORROWING_APPROVAL_ROLES = ['admin', 'leader', 'staff_pj', 'staff pj'];
const BORROWING_PURPOSE_TYPES = ['inside_hospital', 'outside_hospital'];
const BORROWING_DURATION_UNITS = ['day', 'month', 'year'];

// Custom validator untuk memastikan dueDate >= borrowDate
const validateDateRange = (value: any, { req }: any) => {
  if (!value) {
    // Jika dueDate tidak diberikan, itu OK (akan default ke borrowDate + default duration)
    return true;
  }
  
  const borrowDate = req.body.borrowDate;
  if (!borrowDate) {
    throw new Error('borrowDate harus diberikan sebelum dueDate');
  }

  const borrowDateTime = new Date(borrowDate).getTime();
  const dueDateTime = new Date(value).getTime();

  if (dueDateTime < borrowDateTime) {
    throw new Error('Tanggal kembali harus lebih besar atau sama dengan tanggal pinjam');
  }

  return true;
};

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
  authMiddleware,
  [
    body('assetId').isInt({ min: 1 }),
    body('assetType').optional().isIn(['medical', 'non_medical']),
    body('assetDetailId').optional().trim(),
    body('assetDetailName').optional().trim(),
    body('assetDetailCode').optional().trim(),
    body('borrowDate').isISO8601().withMessage('Tanggal pinjam harus format ISO 8601'),
    body('dueDate').optional().isISO8601().custom(validateDateRange),
    body('purpose').trim().notEmpty().withMessage('Keperluan peminjaman wajib diisi'),
    body('borrowerPosition').optional().trim(),
    body('borrowerWorkUnit').optional().trim(),
    body('ownerName').optional().trim(),
    body('ownerPosition').optional().trim(),
    body('ownerWorkUnit').optional().trim(),
    body('purposeType').optional().isIn(BORROWING_PURPOSE_TYPES),
    body('destinationRoom').optional().trim(),
    body('loanDurationValue').optional().isInt({ min: 1 }).toInt(),
    body('loanDurationUnit').optional().isIn(BORROWING_DURATION_UNITS),
    body('quantity').optional().isInt({ min: 1 }).toInt(),
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
    body('dueDate').optional().isISO8601().custom(validateDateRange),
    body('purpose').optional().trim(),
    body('borrowerPosition').optional().trim(),
    body('borrowerWorkUnit').optional().trim(),
    body('ownerName').optional().trim(),
    body('ownerPosition').optional().trim(),
    body('ownerWorkUnit').optional().trim(),
    body('purposeType').optional().isIn(BORROWING_PURPOSE_TYPES),
    body('destinationRoom').optional().trim(),
    body('loanDurationValue').optional().isInt({ min: 1 }).toInt(),
    body('loanDurationUnit').optional().isIn(BORROWING_DURATION_UNITS),
    body('quantity').optional().isInt({ min: 1 }).toInt(),
    body('notes').optional().trim(),
    body('returnCondition').optional().trim(),
    body('returnNotes').optional().trim()
  ],
  borrowingController.update
);

router.patch(
  '/:id/approve',
  authMiddleware,
  requireRole(BORROWING_APPROVAL_ROLES),
  [param('id').isInt({ min: 1 })],
  borrowingController.approve
);

router.patch(
  '/:id/reject',
  authMiddleware,
  requireRole(BORROWING_APPROVAL_ROLES),
  [
    param('id').isInt({ min: 1 }),
    body('reason').trim().notEmpty()
  ],
  borrowingController.reject
);

router.patch(
  '/:id/return',
  authMiddleware,
  requireRole(BORROWING_ACCESS_ROLES),
  [
    param('id').isInt({ min: 1 }),
    body('condition').trim().notEmpty()
  ],
  borrowingController.return
);

router.patch(
  '/:id/validate-return',
  authMiddleware,
  requireRole(BORROWING_APPROVAL_ROLES),
  [param('id').isInt({ min: 1 })],
  borrowingController.validateReturn
);

router.patch(
  '/:id/extend',
  authMiddleware,
  [
    param('id').isInt({ min: 1 }),
    body('newDueDate').isISO8601().withMessage('Tanggal jatuh tempo baru harus format ISO 8601'),
    body('extensionNotes').optional().trim()
  ],
  borrowingController.extend
);

router.get(
  '/user/:userId/blocking',
  authMiddleware,
  [param('userId').isInt({ min: 1 })],
  borrowingController.getBlockingBorrowings
);

router.delete('/:id', [param('id').isInt({ min: 1 })], requireRole(['admin']), borrowingController.delete);

export default router;
