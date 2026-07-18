import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/database', () => ({
  default: { query: vi.fn() },
}));

import pool from '../config/database';
import {
  calculateAhpWeights,
  normalizeConditionScore,
  normalizeFunctionalUrgency,
  normalizeStatusRisk,
  normalizeWeights,
  resolveUsageIntegrationCategory,
  scaleToQuintileBuckets,
} from './dss.service';
import dssService from './dss.service';

const mockQuery = pool.query as unknown as ReturnType<typeof vi.fn>;

type MockAssetRow = {
  id: number;
  asset_code: string;
  name: string;
  category: string;
  status?: string | null;
  condition?: string | null;
  location?: string | null;
  purchase_date?: string | null;
  specifications?: string | null;
};

const buildMockDb = (options: { medicalAssets?: MockAssetRow[]; nonMedicalAssets?: MockAssetRow[] } = {}) => {
  const { medicalAssets = [], nonMedicalAssets = [] } = options;
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM medical_assets')) return [medicalAssets];
    if (sql.includes('FROM non_medical_assets')) return [nonMedicalAssets];
    if (sql.includes('asset_usage_logs')) return [[]];
    if (sql.includes('maintenance_records')) return [[]];
    return [[]];
  });
};

describe('normalizeConditionScore', () => {
  it('maps known Indonesian/English condition labels to a 1-5 severity score', () => {
    expect(normalizeConditionScore('Rusak Berat')).toBe(5);
    expect(normalizeConditionScore('damaged')).toBe(5);
    expect(normalizeConditionScore('Kurang Baik')).toBe(4);
    expect(normalizeConditionScore('Cukup')).toBe(3);
    expect(normalizeConditionScore('Baik')).toBe(1);
    expect(normalizeConditionScore('good')).toBe(1);
  });

  it('treats unrecognized or missing labels as neutral, not best-case', () => {
    expect(normalizeConditionScore(undefined)).toBe(3);
    expect(normalizeConditionScore(null)).toBe(3);
    expect(normalizeConditionScore('')).toBe(3);
    expect(normalizeConditionScore('some-new-status-not-in-the-list')).toBe(3);
  });
});

describe('normalizeStatusRisk', () => {
  it('ranks disposed/maintenance statuses as higher risk than available ones', () => {
    expect(normalizeStatusRisk('disposed')).toBe(5);
    expect(normalizeStatusRisk('Dalam Perbaikan')).toBe(4);
    expect(normalizeStatusRisk('Dipinjam')).toBe(3);
    expect(normalizeStatusRisk('in_use')).toBe(2);
    expect(normalizeStatusRisk('Tersedia')).toBe(1);
  });
});

describe('normalizeFunctionalUrgency', () => {
  it('scores life-critical equipment highest', () => {
    expect(normalizeFunctionalUrgency('Ventilator ICU', null, 'medis')).toBe(5);
  });

  it('falls back to a neutral score for unrecognized equipment', () => {
    expect(normalizeFunctionalUrgency('Unknown Gadget', null, null)).toBe(2);
  });
});

describe('resolveUsageIntegrationCategory', () => {
  it('buckets usage frequency into normal/warning/mandatory_check', () => {
    expect(resolveUsageIntegrationCategory(0)).toBe('normal');
    expect(resolveUsageIntegrationCategory(10)).toBe('normal');
    expect(resolveUsageIntegrationCategory(11)).toBe('warning');
    expect(resolveUsageIntegrationCategory(25)).toBe('mandatory_check');
  });
});

describe('normalizeWeights', () => {
  it('normalizes provided weights so they sum to 1', () => {
    const result = normalizeWeights({ condition: 2, age: 2 });
    const total = Object.values(result).reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(result.condition).toBeCloseTo(0.5, 10);
  });

  it('falls back to default weights when everything is zero or invalid', () => {
    const result = normalizeWeights({ condition: -1, age: 0 });
    const total = Object.values(result).reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe('scaleToQuintileBuckets', () => {
  it('spreads distinct values across the 1-5 range in rank order', () => {
    const buckets = scaleToQuintileBuckets([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(Math.min(...buckets)).toBe(1);
    expect(Math.max(...buckets)).toBe(5);
    // monotonic: a strictly larger raw value never gets a smaller bucket
    for (let i = 1; i < buckets.length; i += 1) {
      expect(buckets[i]).toBeGreaterThanOrEqual(buckets[i - 1]);
    }
  });

  it('assigns a neutral middle bucket when every value is identical', () => {
    expect(scaleToQuintileBuckets([5, 5, 5])).toEqual([3, 3, 3]);
    expect(scaleToQuintileBuckets([0, 0])).toEqual([3, 3]);
  });

  it('returns an empty array for an empty input', () => {
    expect(scaleToQuintileBuckets([])).toEqual([]);
  });
});

describe('calculateAhpWeights', () => {
  // DEFAULT_CRITERIA currently has 8 entries; calculateAhpWeights rejects any
  // pairwise matrix whose size doesn't match it.
  const CRITERIA_COUNT = 8;

  it('recovers uniform weights from a fully consistent uniform matrix', () => {
    const matrix = Array.from({ length: CRITERIA_COUNT }, () => Array.from({ length: CRITERIA_COUNT }, () => 1));
    const result = calculateAhpWeights(matrix);
    expect(result).not.toBeNull();
    expect(result!.consistency.isConsistent).toBe(true);
    expect(result!.weights.condition).toBeCloseTo(1 / CRITERIA_COUNT, 5);
  });

  it('returns null for a malformed (wrong-size) matrix', () => {
    expect(calculateAhpWeights([[1, 2], [0.5, 1]])).toBeNull();
  });

  it('flags a strongly inconsistent matrix as not consistent', () => {
    // A x B implies A should dominate C, but the matrix says the opposite.
    const inconsistent = [
      [1, 9, 1 / 9, 1, 1, 1, 1, 1],
      [1 / 9, 1, 9, 1, 1, 1, 1, 1],
      [9, 1 / 9, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ];
    const result = calculateAhpWeights(inconsistent);
    expect(result).not.toBeNull();
    expect(result!.consistency.isConsistent).toBe(false);
  });
});

describe('DssService.rankAssets (end-to-end pipeline)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('ranks a damaged, higher-risk asset above a good-condition one using default weights', async () => {
    buildMockDb({
      medicalAssets: [
        {
          id: 1,
          asset_code: 'MED-001',
          name: 'Ventilator Baik',
          category: 'medis',
          status: 'Tersedia',
          condition: 'Baik',
          location: 'ICU',
          purchase_date: '2023-01-01',
        },
        {
          id: 2,
          asset_code: 'MED-002',
          name: 'Ventilator Rusak',
          category: 'medis',
          status: 'Dalam Perbaikan',
          condition: 'Rusak Berat',
          location: 'ICU',
          purchase_date: '2010-01-01',
        },
      ],
    });

    const result = await dssService.rankAssets({ assetType: 'medical' });

    expect(result.totalAlternatives).toBe(2);
    expect(result.rankings).toHaveLength(2);
    expect(result.rankings[0].assetCode).toBe('MED-002');
    expect(result.rankings[0].preferenceScore).toBeGreaterThan(result.rankings[1].preferenceScore);
    expect(result.consistency).toBeNull();
  });

  it('counts total alternatives per inventory detail, not per asset row', async () => {
    buildMockDb({
      medicalAssets: [
        {
          id: 1,
          asset_code: 'MED-001',
          name: 'Ventilator Batch',
          category: 'medis',
          status: 'Tersedia',
          condition: 'Baik',
          location: 'ICU',
          purchase_date: '2023-01-01',
          specifications: JSON.stringify({
            details: [
              { id: 'd1', assetCode: 'MED-001-1', inventoryName: 'Unit 1', condition: 'Baik', status: 'Tersedia' },
              { id: 'd2', assetCode: 'MED-001-2', inventoryName: 'Unit 2', condition: 'Baik', status: 'Tersedia' },
              { id: 'd3', assetCode: 'MED-001-3', inventoryName: 'Unit 3', condition: 'Baik', status: 'Tersedia' },
            ],
          }),
        },
      ],
    });

    const result = await dssService.rankAssets({ assetType: 'medical' });

    expect(result.totalAlternatives).toBe(3);
    expect(result.rankings).toHaveLength(3);
  });

  it('returns an empty ranking without error when there are no assets', async () => {
    buildMockDb({ medicalAssets: [], nonMedicalAssets: [] });

    const result = await dssService.rankAssets({ assetType: 'all' });

    expect(result.totalAlternatives).toBe(0);
    expect(result.rankings).toEqual([]);
    expect(result.idealSolutions).toEqual({ positive: {}, negative: {} });
  });

  it('applies AHP-derived weights (not defaults) when the pairwise matrix is consistent', async () => {
    buildMockDb({
      medicalAssets: [
        {
          id: 1,
          asset_code: 'MED-001',
          name: 'Ventilator A',
          category: 'medis',
          status: 'Tersedia',
          condition: 'Baik',
          location: 'ICU',
          purchase_date: '2023-01-01',
        },
        {
          id: 2,
          asset_code: 'MED-002',
          name: 'Ventilator B',
          category: 'medis',
          status: 'Dalam Perbaikan',
          condition: 'Rusak Berat',
          location: 'ICU',
          purchase_date: '2010-01-01',
        },
      ],
    });

    // Slightly favor the first criterion (condition) over all others; still consistent.
    const pairwiseMatrix = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => {
      if (i === j) return 1;
      if (i === 0) return 3;
      if (j === 0) return 1 / 3;
      return 1;
    }));

    const result = await dssService.rankAssets({ assetType: 'medical', pairwiseMatrix });

    expect(result.consistency).not.toBeNull();
    expect(result.consistency!.isConsistent).toBe(true);
    const conditionWeight = result.criteria.find((criterion) => criterion.id === 'condition')!.weight;
    expect(conditionWeight).toBeGreaterThan(1 / 8);
  });
});

describe('DssService.saveRankingHistory (deduplication)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  const buildResult = (weight: number) => ({
    criteria: [
      { id: 'condition', name: 'Kondisi Aset', type: 'benefit' as const, weight },
      { id: 'age', name: 'Usia Aset', type: 'benefit' as const, weight: 1 - weight },
    ],
    consistency: null,
    idealSolutions: { positive: {}, negative: {} },
    generatedAt: new Date().toISOString(),
    totalAlternatives: 5,
    rankings: [],
  });

  it('skips inserting when the last snapshot for the user has identical weights and asset type', async () => {
    const lastWeightsJson = JSON.stringify({ condition: 0.5, age: 0.5 });
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT asset_type, weights_json')) {
        return [[{ asset_type: 'all', weights_json: lastWeightsJson }]];
      }
      return [{}];
    });

    await dssService.saveRankingHistory(7, 'all', buildResult(0.5));

    const insertCalls = mockQuery.mock.calls.filter(([sql]: [string]) => sql.includes('INSERT INTO dss_ranking_history'));
    expect(insertCalls).toHaveLength(0);
  });

  it('inserts a new row when weights differ from the last snapshot', async () => {
    const lastWeightsJson = JSON.stringify({ condition: 0.5, age: 0.5 });
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT asset_type, weights_json')) {
        return [[{ asset_type: 'all', weights_json: lastWeightsJson }]];
      }
      return [{}];
    });

    await dssService.saveRankingHistory(7, 'all', buildResult(0.7));

    const insertCalls = mockQuery.mock.calls.filter(([sql]: [string]) => sql.includes('INSERT INTO dss_ranking_history'));
    expect(insertCalls).toHaveLength(1);
  });

  it('inserts when there is no previous history for the user', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT asset_type, weights_json')) return [[]];
      return [{}];
    });

    await dssService.saveRankingHistory(null, 'all', buildResult(0.5));

    const insertCalls = mockQuery.mock.calls.filter(([sql]: [string]) => sql.includes('INSERT INTO dss_ranking_history'));
    expect(insertCalls).toHaveLength(1);
  });
});
