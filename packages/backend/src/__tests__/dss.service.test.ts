import dssService from '../services/dss.service';

describe('DssService.rankAssets', () => {
  const mockAssets = [
    {
      id: 1,
      asset_code: 'T-1',
      name: 'Test A',
      category: 'medis',
      type: 'medical',
      status: 'in_use',
      condition: 'baik',
      location: 'Room1',
      purchase_date: '2019-01-01',
      specifications: JSON.stringify({ details: [{ id: 'd1', assetCode: 'T-1-1', inventoryName: 'Test A Unit 1', condition: 'baik', status: 'in_use', purchaseDate: '2019-01-01' }] })
    },
    {
      id: 2,
      asset_code: 'T-2',
      name: 'Test B',
      category: 'non_medis',
      type: 'non_medical',
      status: 'in_use',
      condition: 'rusak',
      location: 'Room2',
      purchase_date: '2016-01-01',
      specifications: JSON.stringify({ details: [{ id: 'd1', assetCode: 'T-2-1', inventoryName: 'Test B Unit 1', condition: 'rusak', status: 'in_use', purchaseDate: '2016-01-01' }] })
    }
  ];

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('returns rankings array with valid scores and weights sum to ~1', async () => {
    jest.spyOn(dssService as any, 'getAssets').mockResolvedValue(mockAssets);
    jest.spyOn(dssService as any, 'getUsageCounts').mockResolvedValue(new Map([['medical|1|d1', 10], ['non_medical|2|d1', 5]]));
    jest.spyOn(dssService as any, 'getMaintenanceCounts').mockResolvedValue(new Map([['medical|1|d1', 1], ['non_medical|2|d1', 2]]));

    const result = await dssService.rankAssets({ assetType: 'all', limit: 10 });

    expect(result).toBeDefined();
    expect(Array.isArray(result.rankings)).toBe(true);
    expect(result.rankings.length).toBeGreaterThan(0);

    // weights sum close to 1
    const totalWeight = result.criteria.reduce((s, c) => s + (c.weight || 0), 0);
    expect(totalWeight).toBeGreaterThan(0.99);
    expect(totalWeight).toBeLessThan(1.01);

    // No NaN or Infinite values
    for (const r of result.rankings) {
      expect(Number.isFinite(r.preferenceScore)).toBe(true);
      expect(Number.isFinite(r.positiveDistance)).toBe(true);
      expect(Number.isFinite(r.negativeDistance)).toBe(true);
      Object.values(r.weightedScores).forEach((v) => expect(Number.isFinite(v)).toBe(true));
    }

    expect(result.rankings[0].assetCode).toBe('T-2');
    expect(result.rankings[0].criteriaScores.condition).toBeGreaterThan(result.rankings[1].criteriaScores.condition);
  });

  test('falls back to default weights when provided weights sum to zero', async () => {
    jest.spyOn(dssService as any, 'getAssets').mockResolvedValue(mockAssets);
    jest.spyOn(dssService as any, 'getUsageCounts').mockResolvedValue(new Map());
    jest.spyOn(dssService as any, 'getMaintenanceCounts').mockResolvedValue(new Map());

    const zeroWeights = {
      condition: 0,
      age: 0,
      maintenanceDue: 0,
      usageFrequency: 0,
      maintenanceHistory: 0,
      functionalUrgency: 0,
      statusRisk: 0,
    } as any;

    const result = await dssService.rankAssets({ assetType: 'all', weights: zeroWeights });
    const totalWeight = result.criteria.reduce((s, c) => s + (c.weight || 0), 0);
    expect(totalWeight).toBeGreaterThan(0.99);
    expect(totalWeight).toBeLessThan(1.01);
  });
});
