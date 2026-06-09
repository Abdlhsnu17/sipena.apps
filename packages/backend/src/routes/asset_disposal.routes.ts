import { Router } from 'express';
import disposalController, { disposalValidators } from '../controllers/asset_disposal.controller';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

const ADMIN_LEADER = ['admin', 'leader'];
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
  requireRole(ADMIN_LEADER),
  disposalValidators.review,
  disposalController.approve
);

router.patch(
  '/:id/reject',
  authMiddleware,
  requireRole(ADMIN_LEADER),
  disposalValidators.review,
  disposalController.reject
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole(ADMIN_LEADER),
  disposalValidators.getById,
  disposalController.delete
);

export default router;
