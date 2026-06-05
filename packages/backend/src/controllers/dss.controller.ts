import { Request, Response } from 'express';
import dssService from '../services/dss.service';

export class DssController {
  getRanking = async (req: Request, res: Response): Promise<void> => {
    try {
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
      console.error('DSS ranking error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };
}

export default new DssController();
