export interface DssWeightPreference {
  userId: number;
  weights: Record<string, number>;
  assetType: string;
  updatedAt: Date | string;
}

export interface DssRankingHistoryEntry {
  id: number;
  userId: number | null;
  assetType: string;
  weights: Record<string, number>;
  criteria: Array<{ id: string; name: string; type: string; weight: number }>;
  totalAlternatives: number;
  topRankings: Array<{ rank: number; detailName: string; detailCode: string; preferenceScore: number; recommendation: string }>;
  generatedAt: Date | string;
  createdAt: Date | string;
}
