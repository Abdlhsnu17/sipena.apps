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
  serialNumber?: string | null;
  detailType?: string | null;
  conditionLabel: string;
  statusLabel: string;
  purchaseDate?: string | null;
  lastMaintenance?: string | null;
  lastRepair?: string | null;
  nextMaintenance?: string | null;
  criteriaScores: Record<string, number>;
  normalizedScores?: Record<string, number>;
  weightedScores?: Record<string, number>;
  positiveDistance?: number;
  negativeDistance?: number;
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
  idealSolutions?: {
    positive: Record<string, number>;
    negative: Record<string, number>;
  };
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

export interface DssWeightPreference {
  userId: number;
  weights: Record<string, number>;
  assetType: string;
  updatedAt: string;
}

export interface DssWeightPreferenceResponse {
  success: boolean;
  message: string;
  data: DssWeightPreference | null;
}

export interface DssRankingHistoryEntry {
  id: number;
  userId: number | null;
  assetType: string;
  weights: Record<string, number>;
  criteria: DssCriterion[];
  totalAlternatives: number;
  topRankings: Array<{ rank: number; detailName: string; detailCode: string; preferenceScore: number; recommendation: string }>;
  generatedAt: string;
  createdAt: string;
  pairwiseMatrix?: number[][] | null;
}

export interface DssRankingHistoryResponse {
  success: boolean;
  message: string;
  data: DssRankingHistoryEntry[];
}

export interface DssDeleteRankingHistoryResponse {
  success: boolean;
  message: string;
}

class DssService {
  async getRanking(data: DssRankingRequest = {}): Promise<DssRankingResponse> {
    return apiService.post<DssRankingResponse>('/dss/ranking', data);
  }

  async getWeightPreference(): Promise<DssWeightPreferenceResponse> {
    return apiService.get<DssWeightPreferenceResponse>('/dss/weights');
  }

  async saveWeightPreference(weights: Record<string, number>, assetType: DssAssetType = 'all'): Promise<DssWeightPreferenceResponse> {
    return apiService.put<DssWeightPreferenceResponse>('/dss/weights', { weights, assetType });
  }

  async getRankingHistory(limit = 20): Promise<DssRankingHistoryResponse> {
    return apiService.get<DssRankingHistoryResponse>(`/dss/history?limit=${limit}`);
  }

  async deleteRankingHistory(id: number): Promise<DssDeleteRankingHistoryResponse> {
    return apiService.delete<DssDeleteRankingHistoryResponse>(`/dss/history/${id}`);
  }
}

export const dssService = new DssService();
export default dssService;
