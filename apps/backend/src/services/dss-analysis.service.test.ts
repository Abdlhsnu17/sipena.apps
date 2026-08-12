import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/database', () => ({
  default: { query: vi.fn() },
}));

import pool from '../config/database';
import dssAnalysisService, { perturbWeights } from './dss-analysis.service';
import dssService, { DssCriterion } from './dss.service';

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

const buildMockDb = (medicalAssets: MockAssetRow[]) => {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM medical_assets')) return [medicalAssets];
    if (sql.includes('FROM non_medical_assets')) return [[]];
    if (sql.includes('asset_usage_logs')) return [[]];
    if (sql.includes('maintenance_records')) return [[]];
    return [[]];
  });
};

const buildAssets = (count: number): MockAssetRow[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    asset_code: `MED-${String(index + 1).padStart(3, '0')}`,
    name: index % 2 === 0 ? `Ventilator ICU ${index + 1}` : `Rak Penyimpanan ${index + 1}`,
    category: 'medis',
    status: index % 3 === 0 ? 'Dalam Perbaikan' : 'Tersedia',
    condition: index % 4 === 0 ? 'Rusak Berat' : index % 4 === 1 ? 'Cukup' : 'Baik',
    location: 'ICU',
    purchase_date: `${2010 + (index % 12)}-01-01`,
  }));

describe('perturbWeights', () => {
  const criteria: DssCriterion[] = [
    { id: 'a', name: 'A', type: 'benefit', weight: 0.5 },
    { id: 'b', name: 'B', type: 'benefit', weight: 0.3 },
    { id: 'c', name: 'C', type: 'cost', weight: 0.2 },
  ];

  it('keeps the weights normalized to 1 after a perturbation', () => {
    const perturbed = perturbWeights(criteria, 'a', 0.2);
    const total = perturbed.reduce((sum, criterion) => sum + criterion.weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('raises the targeted weight and lowers the others proportionally', () => {
    const perturbed = perturbWeights(criteria, 'a', 0.2);
    const byId = Object.fromEntries(perturbed.map((criterion) => [criterion.id, criterion.weight]));
    expect(byId.a).toBeGreaterThan(0.5);
    expect(byId.b).toBeLessThan(0.3);
    // Rasio antar kriteria yang tidak digeser harus tetap sama.
    expect(byId.b / byId.c).toBeCloseTo(0.3 / 0.2, 10);
  });

  it('leaves the ranking weights untouched for a zero delta', () => {
    const perturbed = perturbWeights(criteria, 'a', 0);
    perturbed.forEach((criterion, index) => {
      expect(criterion.weight).toBeCloseTo(criteria[index].weight, 10);
    });
  });
});

describe('DssAnalysisService.analyzeWeightSensitivity', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    dssService.invalidateDatasetCache();
  });

  it('reports a Spearman correlation for every criterion and delta scenario', async () => {
    buildMockDb(buildAssets(12));

    const result = await dssAnalysisService.analyzeWeightSensitivity({ assetType: 'medical' });

    expect(result.totalAlternatives).toBe(12);
    expect(result.criteria).toHaveLength(8);
    result.criteria.forEach((criterion) => {
      expect(criterion.scenarios).toHaveLength(4);
      criterion.scenarios.forEach((scenario) => {
        expect(scenario.spearman).toBeLessThanOrEqual(1);
        expect(scenario.spearman).toBeGreaterThanOrEqual(-1);
        expect(scenario.topKOverlap).toBeGreaterThanOrEqual(0);
        expect(scenario.topKOverlap).toBeLessThanOrEqual(1);
      });
    });
    expect(result.mostSensitiveCriterionId).not.toBeNull();
    expect(['stabil', 'cukup stabil', 'sensitif']).toContain(result.overallStability);
  });

  it('produces a perfectly stable report when the perturbation is zero', async () => {
    buildMockDb(buildAssets(8));

    const result = await dssAnalysisService.analyzeWeightSensitivity({ assetType: 'medical', deltas: [0] });

    // Delta 0 disaring, sehingga tidak ada skenario yang dijalankan dan
    // laporan tetap valid (bukan NaN) alih-alih gagal.
    result.criteria.forEach((criterion) => {
      expect(criterion.scenarios).toHaveLength(0);
      expect(criterion.minSpearman).toBe(1);
      expect(criterion.stability).toBe('stabil');
    });
  });

  it('returns an empty report instead of failing when there is no data', async () => {
    buildMockDb([]);

    const result = await dssAnalysisService.analyzeWeightSensitivity({ assetType: 'medical' });

    expect(result.totalAlternatives).toBe(0);
    expect(result.criteria).toEqual([]);
    expect(result.mostSensitiveCriterionId).toBeNull();
  });

  it('limits the baseline preview to the requested top K', async () => {
    buildMockDb(buildAssets(20));

    const result = await dssAnalysisService.analyzeWeightSensitivity({ assetType: 'medical', topK: 5 });

    expect(result.baselineTop).toHaveLength(5);
    expect(result.baselineTop[0].rank).toBe(1);
  });
});

describe('DssAnalysisService.compareScenarios', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    dssService.invalidateDatasetCache();
  });

  const balancedWeights = {
    condition: 0.125,
    age: 0.125,
    maintenanceDue: 0.125,
    usageFrequency: 0.125,
    maintenanceHistory: 0.125,
    functionalUrgency: 0.125,
    statusRisk: 0.125,
    maintenanceCost: 0.125,
  };

  const conditionHeavyWeights = {
    ...balancedWeights,
    condition: 0.6,
    age: 0.05,
    maintenanceDue: 0.05,
    usageFrequency: 0.05,
    maintenanceHistory: 0.05,
    functionalUrgency: 0.1,
    statusRisk: 0.05,
    maintenanceCost: 0.05,
  };

  it('reports a perfect correlation and no movement for two identical scenarios', async () => {
    buildMockDb(buildAssets(15));

    const result = await dssAnalysisService.compareScenarios(
      { label: 'A', weights: balancedWeights },
      { label: 'B', weights: balancedWeights },
      { assetType: 'medical', topK: 10 }
    );

    expect(result.spearman).toBeCloseTo(1, 6);
    expect(result.topKOverlap).toBe(1);
    expect(result.summary.enteredTopK).toBe(0);
    expect(result.summary.leftTopK).toBe(0);
    expect(result.summary.biggestMove).toBe(0);
    result.movements.forEach((movement) => {
      expect(movement.delta).toBe(0);
    });
  });

  it('lists rank movements only for alternatives inside either scenario top-K', async () => {
    buildMockDb(buildAssets(30));

    const result = await dssAnalysisService.compareScenarios(
      { label: 'Seimbang', weights: balancedWeights },
      { label: 'Kondisi dominan', weights: conditionHeavyWeights },
      { assetType: 'medical', topK: 5 }
    );

    expect(result.totalAlternatives).toBe(30);
    expect(result.movements.length).toBeGreaterThanOrEqual(5);
    result.movements.forEach((movement) => {
      expect(movement.inTopKA || movement.inTopKB).toBe(true);
      expect(movement.delta).toBe(movement.rankA - movement.rankB);
    });
    // Alternatif yang masuk top-K hanya di skenario B harus terhitung sebagai masuk.
    const entered = result.movements.filter((movement) => !movement.inTopKA && movement.inTopKB).length;
    expect(result.summary.enteredTopK).toBe(entered);
  });

  it('keeps both scenario labels and their applied weights in the response', async () => {
    buildMockDb(buildAssets(10));

    const result = await dssAnalysisService.compareScenarios(
      { label: 'Baseline RS', weights: balancedWeights },
      { label: 'Kondisi 60%', weights: conditionHeavyWeights },
      { assetType: 'medical' }
    );

    expect(result.scenarios.map((scenario) => scenario.label)).toEqual(['Baseline RS', 'Kondisi 60%']);
    const conditionWeightB = result.scenarios[1].criteria.find((criterion) => criterion.id === 'condition')!.weight;
    expect(conditionWeightB).toBeCloseTo(0.6, 6);
  });

  it('returns an empty comparison when there is no data', async () => {
    buildMockDb([]);

    const result = await dssAnalysisService.compareScenarios(
      { label: 'A', weights: balancedWeights },
      { label: 'B', weights: conditionHeavyWeights },
      { assetType: 'medical' }
    );

    expect(result.totalAlternatives).toBe(0);
    expect(result.movements).toEqual([]);
  });
});

describe('DssAnalysisService.compareMethods', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    dssService.invalidateDatasetCache();
  });

  it('ranks the same dataset with TOPSIS, SAW, and WP and reports their agreement', async () => {
    buildMockDb(buildAssets(15));

    const result = await dssAnalysisService.compareMethods({ assetType: 'medical', topK: 5 });

    expect(result.methods.map((method) => method.id)).toEqual(['topsis', 'saw', 'wp']);
    result.methods.forEach((method) => {
      expect(method.top).toHaveLength(5);
    });
    expect(result.agreements).toHaveLength(3);
    result.agreements.forEach((agreement) => {
      expect(agreement.spearman).toBeLessThanOrEqual(1);
      expect(agreement.spearman).toBeGreaterThanOrEqual(-1);
      expect(agreement.kendall).toBeLessThanOrEqual(1);
      expect(agreement.kendall).toBeGreaterThanOrEqual(-1);
    });
    expect(result.interpretation).toBeTruthy();
  });

  it('returns an empty comparison when there are no alternatives', async () => {
    buildMockDb([]);

    const result = await dssAnalysisService.compareMethods({ assetType: 'medical' });

    expect(result.totalAlternatives).toBe(0);
    expect(result.methods).toEqual([]);
    expect(result.agreements).toEqual([]);
  });
});
