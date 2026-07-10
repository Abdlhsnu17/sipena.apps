import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import dssService from '../services/dss.service';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('controller:dss');

export class DssController {
  getRanking = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
        return;
      }

      const result = await dssService.rankAssets({
        weights: req.body?.weights,
        pairwiseMatrix: req.body?.pairwiseMatrix,
        assetType: req.body?.assetType || 'all',
        limit: req.body?.limit,
      });

      res.json({
        success: true,
        message: 'DSS ranking generated successfully',
        data: result,
      });
    } catch (error) {
      logger.error('DSS ranking error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  /* debugRanking is intentionally removed: mutating the singleton DSS service
     made a development request contaminate real subsequent rankings. */
  /*
  debugRanking = async (req: Request, res: Response): Promise<void> => {
    if ((process.env.NODE_ENV || 'development') === 'production') {
      res.status(403).json({ success: false, message: 'Debug endpoint disabled in production' });
      return;
    }

    try {
      const debugService = dssService as unknown as {
        getAssets: () => Promise<unknown[]>;
        getUsageCounts: () => Promise<Map<string, number>>;
        getMaintenanceCounts: () => Promise<Map<string, number>>;
      };

      // Provide small in-memory mock dataset to run DSS without DB
      debugService.getAssets = async () => {
        return [
          {
            id: 1,
            asset_code: 'DBG-001',
            name: 'Mock Ventilator',
            category: 'medis',
            type: 'medical',
            status: 'in_use',
            condition: 'rusak',
            location: 'ICU',
            purchase_date: '2018-06-01',
            specifications: JSON.stringify({ details: [{ id: 'd1', assetCode: 'DBG-001-1', inventoryName: 'Mock Ventilator Unit 1', condition: 'rusak', status: 'in_use', purchaseDate: '2018-06-01' }] })
          },
          {
            id: 2,
            asset_code: 'DBG-002',
            name: 'Mock Stretcher',
            category: 'non_medis',
            type: 'non_medical',
            status: 'in_use',
            condition: 'baik',
            location: 'Ward',
            purchase_date: '2020-01-01',
            specifications: JSON.stringify({ details: [{ id: 'd1', assetCode: 'DBG-002-1', inventoryName: 'Mock Stretcher Unit 1', condition: 'baik', status: 'in_use', purchaseDate: '2020-01-01' }] })
          }
        ];
      };

      debugService.getUsageCounts = async () => new Map([['medical|1|d1', 20], ['non_medical|2|d1', 5]]);
      debugService.getMaintenanceCounts = async () => new Map([['medical|1|d1', 2], ['non_medical|2|d1', 0]]);

      const result = await dssService.rankAssets({ assetType: 'all', limit: 50 });
      res.json({ success: true, message: 'Debug DSS ranking generated', data: result });
    } catch (error) {
      logger.error('DSS debug error', { error });
      res.status(500).json({ success: false, message: 'Debug DSS failed' });
    }
  };
  */
}

export default new DssController();
