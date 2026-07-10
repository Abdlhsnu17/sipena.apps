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
    body('weights.*').optional().isFloat({ min: 0 }),
    body('pairwiseMatrix').optional().isArray(),
    body('pairwiseMatrix.*').optional().isArray(),
    body('pairwiseMatrix.*.*').optional().isFloat({ gt: 0 }),
  ],
  dssController.getRanking
);

export default router;
