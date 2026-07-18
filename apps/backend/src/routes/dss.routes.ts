import { Router } from 'express';
import { body, param } from 'express-validator';
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

router.get('/weights', dssController.getWeightPreference);

router.put(
  '/weights',
  [
    body('weights').isObject(),
    body('weights.*').isFloat({ min: 0 }),
    body('assetType').optional().isIn(['all', 'medical', 'non_medical']),
  ],
  dssController.saveWeightPreference
);

router.get('/history', dssController.getRankingHistory);
router.delete('/history/:id', [param('id').isInt({ min: 1 }).toInt()], dssController.deleteRankingHistory);

export default router;
