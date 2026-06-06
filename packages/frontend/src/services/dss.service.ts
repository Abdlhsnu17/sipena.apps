import apiService from './api.service';

export type DssCriterionType = 'benefit' | 'cost';
export type DssAssetType = 'all' | 'medical' | 'non_medical';

export interface DssCriterion {
  id: string;
  name: string;
  type: DssCriterionType;
  weight: number;
}

export interface DssAssetRanking {
  rank: number;
  assetId: number;
  assetType: 'medical' | 'non_medical';
  assetName: string;
  assetCode: string;
  assetCategory: string;
  assetLocation?: string | null;
  detailId: string;
  detailName: string;
  detailCode: string;
  detailType?: string | null;
  conditionLabel: string;
  statusLabel: string;
  purchaseDate?: string | null;
  lastMaintenance?: string | null;
  lastRepair?: string | null;
  nextMaintenance?: string | null;
  criteriaScores: Record<string, number>;
  preferenceScore: number;
  recommendation: string;
}

export interface DssRankingResult {
  criteria: DssCriterion[];
  consistency: {
    lambdaMax: number;
    consistencyIndex: number;
    consistencyRatio: number;
    isConsistent: boolean;
  } | null;
  generatedAt: string;
  totalAlternatives: number;
  rankings: DssAssetRanking[];
}

export interface DssRankingRequest {
  weights?: Record<string, number>;
  pairwiseMatrix?: number[][];
  assetType?: DssAssetType;
  limit?: number;
}

export interface DssRankingResponse {
  success: boolean;
  message: string;
  data: DssRankingResult;
}

class DssService {
  async getRanking(data: DssRankingRequest = {}): Promise<DssRankingResponse> {
    return apiService.post<DssRankingResponse>('/dss/ranking', data);
  }
}

export const dssService = new DssService();
export default dssService;
