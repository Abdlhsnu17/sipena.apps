import { Router } from 'express';
import sanctionsController, { sanctionsValidators } from '../controllers/sanctions.controller';
import { requireRole } from '../middlewares/authMiddleware';

const router = Router();

const ADMIN_LEADER = ['admin', 'leader'];

router.get('/stats', requireRole(ADMIN_LEADER), sanctionsController.getStats);

router.get(
  '/',
  requireRole(ADMIN_LEADER),
  sanctionsValidators.getAll,
  sanctionsController.getAll
);

router.patch(
  '/:id/resolve',
  requireRole(ADMIN_LEADER),
  sanctionsValidators.resolve,
  sanctionsController.resolve
);

router.patch(
  '/:id/waive',
  requireRole(ADMIN_LEADER),
  sanctionsValidators.waive,
  sanctionsController.waive
);

export default router;
