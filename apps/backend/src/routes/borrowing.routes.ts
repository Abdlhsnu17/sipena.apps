import { Router } from 'express';
import { body, param, query } from 'express-validator';
import borrowingController from '../controllers/borrowing.controller';
import { requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate-request.middleware';

const router = Router();

const BORROWING_STATUSES = ['pending', 'approved', 'rejected', 'borrowed', 'returned', 'overdue'];
const BORROWING_ACCESS_ROLES = ['admin', 'leader', 'staff', 'staff_pj', 'staff pj', 'user'];
const BORROWING_APPROVAL_ROLES = ['admin', 'leader', 'staff_pj', 'staff pj'];
const BORROWING_PURPOSE_TYPES = ['inside_hospital', 'outside_hospital'];
const BORROWING_DURATION_UNITS = ['day', 'month', 'year'];
const INVALID_BORROW_DATE_MESSAGE = 'Tanggal pinjam harus berupa tanggal dan waktu yang valid.';
const INVALID_DUE_DATE_MESSAGE = 'Tanggal kembali harus berupa tanggal dan waktu yang valid.';
const INVALID_NEW_DUE_DATE_MESSAGE = 'Tanggal jatuh tempo baru harus berupa tanggal dan waktu yang valid.';

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
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    query('status').optional().isIn(BORROWING_STATUSES),
    query('userId').optional().isInt({ min: 1 }).toInt(),
    query('assetId').optional().isInt({ min: 1 }).toInt(),
    query('assetType').optional().isIn(['medical', 'non_medical']),
    query('search').optional().trim().isLength({ max: 200 }),
    query('lockedOnly').optional().isIn(['true', 'false']),
    query('source').optional().isIn(['medis', 'non_medis']),
    validateRequest
  ],
  borrowingController.getAll
);

router.get(
  '/owner-candidates',
  [
    query('search').optional().trim().isLength({ max: 100 }),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    validateRequest
  ],
  borrowingController.getOwnerCandidates
);

// Harus berada di atas '/:id' agar 'locks' tidak dianggap sebagai id.
router.get('/locks', borrowingController.getInventoryLocks);

router.get('/:id', [param('id').isInt({ min: 1 }), validateRequest], borrowingController.getById);

router.post(
  '/',
  [
    body('assetId').exists({ checkFalsy: true }).isInt({ min: 1 }),
    body('assetType').optional().isIn(['medical', 'non_medical']),
    body('assetDetailId').optional().trim(),
    body('assetDetailName').optional().trim(),
    body('assetDetailCode').optional().trim(),
    body('borrowDate').exists({ checkFalsy: true }).isISO8601().withMessage(INVALID_BORROW_DATE_MESSAGE),
    body('dueDate').optional().isISO8601().withMessage(INVALID_DUE_DATE_MESSAGE).custom(validateDateRange),
    body('purpose').trim().notEmpty().withMessage('Keperluan peminjaman wajib diisi'),
    body('borrowerPosition').optional().trim(),
    body('borrowerWorkUnit').optional().trim(),
    body('ownerUserId').optional().isInt({ min: 1 }).toInt(),
    body('ownerName').optional().trim(),
    body('ownerNip').optional().trim(),
    body('ownerPosition').optional().trim(),
    body('ownerWorkUnit').optional().trim(),
    body('purposeType').optional().isIn(BORROWING_PURPOSE_TYPES),
    body('destinationRoom').optional().trim(),
    body('loanDurationValue').optional().isInt({ min: 1 }).toInt(),
    body('loanDurationUnit').optional().isIn(BORROWING_DURATION_UNITS),
    body('quantity').optional().isInt({ min: 1 }).toInt(),
    body('notes').optional().trim(),
    validateRequest
  ],
  borrowingController.create
);

router.patch(
  '/:id',
  [
    requireRole(['admin', 'leader']),
    param('id').isInt({ min: 1 }),
    body('borrowDate').optional().isISO8601().withMessage(INVALID_BORROW_DATE_MESSAGE),
    body('dueDate').optional().isISO8601().withMessage(INVALID_DUE_DATE_MESSAGE).custom(validateDateRange),
    body('purpose').optional().trim(),
    body('borrowerPosition').optional().trim(),
    body('borrowerWorkUnit').optional().trim(),
    body('ownerUserId').optional().isInt({ min: 1 }).toInt(),
    body('ownerName').optional().trim(),
    body('ownerNip').optional().trim(),
    body('ownerPosition').optional().trim(),
    body('ownerWorkUnit').optional().trim(),
    body('purposeType').optional().isIn(BORROWING_PURPOSE_TYPES),
    body('destinationRoom').optional().trim(),
    body('loanDurationValue').optional().isInt({ min: 1 }).toInt(),
    body('loanDurationUnit').optional().isIn(BORROWING_DURATION_UNITS),
    body('quantity').optional().isInt({ min: 1 }).toInt(),
    body('notes').optional().trim(),
    body('returnCondition').optional().trim(),
    body('returnNotes').optional().trim(),
    validateRequest
  ],
  borrowingController.update
);

router.patch(
  '/:id/approve',
  [
    requireRole(BORROWING_APPROVAL_ROLES),
    param('id').isInt({ min: 1 }),
    validateRequest
  ],
  borrowingController.approve
);

router.patch(
  '/:id/reject',
  [
    requireRole(BORROWING_APPROVAL_ROLES),
    param('id').isInt({ min: 1 }),
    body('reason').trim().notEmpty(),
    validateRequest
  ],
  borrowingController.reject
);

router.patch(
  '/:id/return',
  [
    requireRole(BORROWING_ACCESS_ROLES),
    param('id').isInt({ min: 1 }),
    body('condition').trim().notEmpty(),
    validateRequest
  ],
  borrowingController.return
);

router.patch(
  '/:id/validate-return',
  [
    requireRole(BORROWING_APPROVAL_ROLES),
    param('id').isInt({ min: 1 }),
    validateRequest
  ],
  borrowingController.validateReturn
);

router.patch(
  '/:id/extend',
  [
    param('id').isInt({ min: 1 }),
    body('newDueDate').isISO8601().withMessage(INVALID_NEW_DUE_DATE_MESSAGE),
    body('extensionNotes').optional().trim(),
    validateRequest
  ],
  borrowingController.extend
);

router.get(
  '/user/:userId/blocking',
  [param('userId').isInt({ min: 1 }), validateRequest],
  borrowingController.getBlockingBorrowings
);

router.delete(
  '/:id',
  [
    requireRole(['admin']),
    param('id').isInt({ min: 1 }),
    body('deleteReason').trim().notEmpty().withMessage('Alasan penghapusan wajib diisi'),
    validateRequest
  ],
  borrowingController.delete
);

export default router;
