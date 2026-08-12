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
  pagination?: {
    limit: number;
    offset: number;
    returned: number;
    total: number;
  };
  /** Hanya ada pada permintaan dengan saveHistory; false berarti simpan riwayat gagal. */
  historySaved?: boolean;
  rankings: DssAssetRanking[];
}

export interface DssRankingRequest {
  weights?: Record<string, number>;
  pairwiseMatrix?: number[][];
  assetType?: DssAssetType;
  limit?: number;
  // Only user-initiated recalculations ("Hitung Ulang") should be logged to
  // "Riwayat Perhitungan" — background/auto loads (mount, filter defaults)
  // omit this so the history isn't flooded with non-actions.
  saveHistory?: boolean;
  /** Nama skenario yang tampil di Riwayat Perhitungan; hanya dipakai saat saveHistory true. */
  label?: string;
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
  label: string | null;
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

export type DssStabilityLabel = 'stabil' | 'cukup stabil' | 'sensitif';

export interface DssSensitivityScenario {
  delta: number;
  adjustedWeight: number;
  spearman: number;
  kendall: number;
  topKOverlap: number;
  rankOneChanged: boolean;
}

export interface DssSensitivityCriterionReport {
  id: string;
  name: string;
  baseWeight: number;
  scenarios: DssSensitivityScenario[];
  meanSpearman: number;
  minSpearman: number;
  minTopKOverlap: number;
  rankOneChanges: number;
  stability: DssStabilityLabel;
}

export interface DssSensitivityResult {
  assetType: string;
  generatedAt: string;
  totalAlternatives: number;
  topK: number;
  deltas: number[];
  criteria: DssSensitivityCriterionReport[];
  baselineTop: Array<{ rank: number; detailName: string; detailCode: string; preferenceScore: number }>;
  mostSensitiveCriterionId: string | null;
  overallMinSpearman: number;
  overallStability: DssStabilityLabel;
  interpretation: string;
}

export interface DssMethodComparisonResult {
  assetType: string;
  generatedAt: string;
  totalAlternatives: number;
  topK: number;
  criteria: DssCriterion[];
  methods: Array<{
    id: 'topsis' | 'saw' | 'wp';
    name: string;
    top: Array<{ rank: number; detailName: string; detailCode: string; score: number }>;
  }>;
  agreements: Array<{
    methodA: string;
    methodB: string;
    spearman: number;
    kendall: number;
    topKOverlap: number;
  }>;
  interpretation: string;
}

export interface DssScenarioComparisonResult {
  assetType: string;
  generatedAt: string;
  totalAlternatives: number;
  topK: number;
  scenarios: Array<{ label: string; criteria: DssCriterion[] }>;
  spearman: number;
  kendall: number;
  topKOverlap: number;
  summary: {
    enteredTopK: number;
    leftTopK: number;
    unchanged: number;
    biggestMove: number;
  };
  movements: Array<{
    detailName: string;
    detailCode: string;
    rankA: number;
    rankB: number;
    delta: number;
    scoreA: number;
    scoreB: number;
    inTopKA: boolean;
    inTopKB: boolean;
  }>;
  interpretation: string;
}

export interface DssScenarioComparisonRequest {
  assetType?: DssAssetType;
  topK?: number;
  /** Tepat dua skenario; tiap skenario memakai historyId atau weights. */
  scenarios: Array<{ historyId?: number; label?: string; weights?: Record<string, number> }>;
}

export interface DssScenarioComparisonResponse {
  success: boolean;
  message: string;
  data: DssScenarioComparisonResult;
}

export interface DssAnalysisRequest {
  assetType?: DssAssetType;
  weights?: Record<string, number>;
  pairwiseMatrix?: number[][];
  topK?: number;
  deltas?: number[];
}

export interface DssSensitivityResponse {
  success: boolean;
  message: string;
  data: DssSensitivityResult;
}

export interface DssMethodComparisonResponse {
  success: boolean;
  message: string;
  data: DssMethodComparisonResult;
}

class DssService {
  async getRanking(data: DssRankingRequest = {}): Promise<DssRankingResponse> {
    return apiService.post<DssRankingResponse>('/dss/ranking', data);
  }

  /** Bandingkan dua skenario pembobotan; keduanya dihitung ulang penuh di backend. */
  async getScenarioComparison(data: DssScenarioComparisonRequest): Promise<DssScenarioComparisonResponse> {
    return apiService.post<DssScenarioComparisonResponse>('/dss/scenario-comparison', data);
  }

  /** Uji sensitivitas bobot: seberapa stabil peringkat saat bobot digeser. */
  async getSensitivityAnalysis(data: DssAnalysisRequest = {}): Promise<DssSensitivityResponse> {
    return apiService.post<DssSensitivityResponse>('/dss/sensitivity', data);
  }

  /** Pembandingan TOPSIS dengan SAW dan WP pada data serta bobot yang sama. */
  async getMethodComparison(data: DssAnalysisRequest = {}): Promise<DssMethodComparisonResponse> {
    return apiService.post<DssMethodComparisonResponse>('/dss/method-comparison', data);
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
