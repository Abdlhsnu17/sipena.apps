import dssService from '../services/dss.service';

describe('DssService AHP inconsistency fallback', () => {
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
    }
  ];

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('falls back to default weights when pairwise matrix is inconsistent', async () => {
    jest.spyOn(dssService as any, 'getAssets').mockResolvedValue(mockAssets);
    jest.spyOn(dssService as any, 'getUsageCounts').mockResolvedValue(new Map());
    jest.spyOn(dssService as any, 'getMaintenanceCounts').mockResolvedValue(new Map());

    const n = 7; // matches DEFAULT_CRITERIA length
    // Create a highly inconsistent matrix: first row very large values, others ones
    const matrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, () => (i === 0 ? 100 : 1)));

    const result = await dssService.rankAssets({ assetType: 'all', pairwiseMatrix: matrix });

    expect(result).toBeDefined();
    expect(result.consistency).toBeDefined();
    // AHP computation should detect inconsistency and set isConsistent = false
    expect(result.consistency!.isConsistent).toBe(false);

    // When inconsistent, service falls back to DEFAULT_WEIGHTS (which sum to 1)
    const totalWeight = result.criteria.reduce((s, c) => s + (c.weight || 0), 0);
    expect(totalWeight).toBeGreaterThan(0.99);
    expect(totalWeight).toBeLessThan(1.01);

    // DEFAULT_WEIGHTS has known value for 'condition'
    const conditionWeight = result.criteria.find((c) => c.id === 'condition')!;
    expect(conditionWeight.weight).toBeCloseTo(0.22, 5);
  });
});
