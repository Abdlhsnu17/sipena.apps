import { Router } from 'express';
import { body, param } from 'express-validator';
import dssController from '../controllers/dss.controller';
import { validateRequest } from '../middlewares/validate-request.middleware';

const router = Router();

router.post(
  '/ranking',
  [
    body('assetType').optional().isIn(['all', 'medical', 'non_medical']),
    body('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    body('offset').optional().isInt({ min: 0 }).toInt(),
    body('weights').optional().isObject(),
    body('weights.*').optional().isFloat({ min: 0 }),
    body('pairwiseMatrix').optional().isArray(),
    body('pairwiseMatrix.*').optional().isArray(),
    body('pairwiseMatrix.*.*').optional().isFloat({ gt: 0 }),
    body('saveHistory').optional().isBoolean().toBoolean(),
    body('label').optional({ values: 'falsy' }).isString().trim().isLength({ max: 120 }),
    validateRequest
  ],
  dssController.getRanking
);

// Validasi bobot/pairwise sama dengan /ranking supaya analisis selalu diuji
// pada konfigurasi bobot yang benar-benar bisa dipakai menghitung ranking.
router.post(
  '/sensitivity',
  [
    body('assetType').optional().isIn(['all', 'medical', 'non_medical']),
    body('weights').optional().isObject(),
    body('weights.*').optional().isFloat({ min: 0 }),
    body('pairwiseMatrix').optional().isArray(),
    body('pairwiseMatrix.*').optional().isArray(),
    body('pairwiseMatrix.*.*').optional().isFloat({ gt: 0 }),
    body('deltas').optional().isArray({ min: 1, max: 10 }),
    body('deltas.*').optional().isFloat({ min: -1, max: 1 }),
    body('topK').optional().isInt({ min: 1, max: 50 }).toInt(),
    validateRequest
  ],
  dssController.getSensitivityAnalysis
);

router.post(
  '/method-comparison',
  [
    body('assetType').optional().isIn(['all', 'medical', 'non_medical']),
    body('weights').optional().isObject(),
    body('weights.*').optional().isFloat({ min: 0 }),
    body('pairwiseMatrix').optional().isArray(),
    body('pairwiseMatrix.*').optional().isArray(),
    body('pairwiseMatrix.*.*').optional().isFloat({ gt: 0 }),
    body('topK').optional().isInt({ min: 1, max: 50 }).toInt(),
    validateRequest
  ],
  dssController.getMethodComparison
);

router.post(
  '/scenario-comparison',
  [
    body('assetType').optional().isIn(['all', 'medical', 'non_medical']),
    body('scenarios').isArray({ min: 2, max: 2 }),
    body('scenarios.*.historyId').optional().isInt({ min: 1 }).toInt(),
    body('scenarios.*.label').optional({ values: 'falsy' }).isString().trim().isLength({ max: 120 }),
    body('scenarios.*.weights').optional().isObject(),
    body('scenarios.*.weights.*').optional().isFloat({ min: 0 }),
    body('topK').optional().isInt({ min: 1, max: 50 }).toInt(),
    validateRequest
  ],
  dssController.getScenarioComparison
);

router.get('/weights', dssController.getWeightPreference);

router.put(
  '/weights',
  [
    body('weights').isObject(),
    body('weights.*').isFloat({ min: 0 }),
    body('assetType').optional().isIn(['all', 'medical', 'non_medical']),
    validateRequest
  ],
  dssController.saveWeightPreference
);

router.get('/history', dssController.getRankingHistory);
router.delete('/history/:id', [param('id').isInt({ min: 1 }).toInt(), validateRequest], dssController.deleteRankingHistory);

export default router;
