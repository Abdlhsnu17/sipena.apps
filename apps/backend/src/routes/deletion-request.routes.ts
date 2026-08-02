import { Router } from 'express';
import deletionRequestController, { deletionRequestValidators } from '../controllers/deletion-request.controller';
import { requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get(
  '/',
  requireRole(['admin', 'leader']),
  deletionRequestValidators.getAll,
  deletionRequestController.getAll
);

router.post(
  '/',
  requireRole(['leader']),
  deletionRequestValidators.create,
  deletionRequestController.create
);

router.patch(
  '/:id/approve',
  requireRole(['admin']),
  deletionRequestValidators.review,
  deletionRequestController.approve
);

router.patch(
  '/:id/reject',
  requireRole(['admin']),
  deletionRequestValidators.review,
  deletionRequestController.reject
);

export default router;
