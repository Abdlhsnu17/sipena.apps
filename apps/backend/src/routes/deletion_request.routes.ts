import { Router } from 'express';
import deletionRequestController, { deletionRequestValidators } from '../controllers/deletion_request.controller';
import { requireRole } from '../middlewares/authMiddleware';

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
