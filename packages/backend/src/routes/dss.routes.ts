import { Router } from 'express';
import { body } from 'express-validator';
import dssController from '../controllers/dss.controller';

const router = Router();

router.post(
  '/ranking',
  [
    body('assetType').optional().isIn(['all', 'medical', 'non_medical']),
    body('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    body('weights').optional().isObject(),
    body('pairwiseMatrix').optional().isArray(),
  ],
  dssController.getRanking
);

// Debug route (non-production only)
router.post('/debug', dssController.debugRanking);

export default router;
