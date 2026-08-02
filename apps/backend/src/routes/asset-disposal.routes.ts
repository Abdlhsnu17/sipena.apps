import { Router } from 'express';
import disposalController, { disposalValidators } from '../controllers/asset-disposal.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

const REQUESTER_ROLES = ['admin', 'leader', 'staff', 'staff_pj'];

router.get('/', disposalValidators.getAll, disposalController.getAll);
router.get('/:id', disposalValidators.getById, disposalController.getById);

router.post(
  '/',
  authMiddleware,
  requireRole(REQUESTER_ROLES),
  disposalValidators.create,
  disposalController.create
);

router.patch(
  '/:id/approve',
  authMiddleware,
  requireRole(['admin']),
  disposalValidators.review,
  disposalController.approve
);

router.patch(
  '/:id/reject',
  authMiddleware,
  requireRole(['admin']),
  disposalValidators.review,
  disposalController.reject
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole(['admin']),
  disposalValidators.getById,
  disposalController.delete
);

export default router;
