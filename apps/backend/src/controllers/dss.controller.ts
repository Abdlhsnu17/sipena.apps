import { Request, Response } from 'express';
import dssService from '../services/dss.service';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('controller:dss');

const getActorUserId = (req: Request): number | null => {
  const parsed = Number(req.user?.id);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export class DssController {
  getRanking = async (req: Request, res: Response): Promise<void> => {
    try {
      const assetType = req.body?.assetType || 'all';
      const result = await dssService.rankAssets({
        weights: req.body?.weights,
        pairwiseMatrix: req.body?.pairwiseMatrix,
        assetType,
        limit: req.body?.limit,
      });

      res.json({
        success: true,
        message: 'DSS ranking generated successfully',
        data: result,
      });

      const userId = getActorUserId(req);
      if (result.totalAlternatives > 0 && req.body?.saveHistory === true) {
        // Only persist the pairwise matrix when it's actually what produced these
        // weights (CR passed) — if AHP was inconsistent and the service fell back
        // to manual/default weights, storing the failed matrix would misrepresent
        // this snapshot as AHP-derived when "Gunakan Bobot" restores it later.
        const appliedPairwiseMatrix = result.consistency?.isConsistent ? (req.body?.pairwiseMatrix ?? null) : null;
        dssService.saveRankingHistory(userId, assetType, result, appliedPairwiseMatrix).catch((error) => {
          logger.warn('Failed to persist DSS ranking history', { error });
        });
      }
    } catch (error) {
      logger.error('DSS ranking error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  getWeightPreference = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getActorUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const preference = await dssService.getWeightPreference(userId);
      res.json({ success: true, message: 'DSS weight preference fetched', data: preference });
    } catch (error) {
      logger.error('DSS weight preference fetch error', { error });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  saveWeightPreference = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getActorUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const preference = await dssService.saveWeightPreference(userId, req.body.weights, req.body.assetType || 'all');
      res.json({ success: true, message: 'DSS weight preference saved', data: preference });
    } catch (error) {
      logger.error('DSS weight preference save error', { error });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  getRankingHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getActorUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const limit = Number(req.query.limit) || 20;
      const history = await dssService.listRankingHistory(userId, limit);
      res.json({ success: true, message: 'DSS ranking history fetched', data: history });
    } catch (error) {
      logger.error('DSS ranking history fetch error', { error });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  deleteRankingHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getActorUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const deleted = await dssService.deleteRankingHistory(userId, Number(req.params.id));
      if (!deleted) {
        res.status(404).json({ success: false, message: 'Riwayat perhitungan tidak ditemukan' });
        return;
      }
      res.json({ success: true, message: 'Riwayat perhitungan berhasil dihapus' });
    } catch (error) {
      logger.error('DSS ranking history delete error', { error });
      res.status(500).json({ success: false, message: 'Internal server error' });
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
