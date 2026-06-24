import dssService from '../src/services/dss.service';

async function run() {
  // Mock internal data-fetching methods to avoid DB dependency
  // @ts-ignore
  dssService.getAssets = async (assetType?: any) => {
    return [
      {
        id: 1,
        asset_code: 'A001',
        name: 'Ventilator A',
        category: 'medis',
        type: 'medical',
        status: 'in_use',
        condition: 'rusak ringan',
        location: 'ICU',
        purchase_date: '2018-06-01',
        specifications: JSON.stringify({ details: [{ id: 'd1', assetCode: 'A001-1', inventoryName: 'Ventilator A - Unit 1', condition: 'rusak', status: 'in_use', purchaseDate: '2018-06-01', lastMaintenance: '2025-01-01', nextMaintenance: '2026-01-01' }] })
      },
      {
        id: 2,
        asset_code: 'A002',
        name: 'Stretcher B',
        category: 'non_medis',
        type: 'non_medical',
        status: 'in_use',
        condition: 'baik',
        location: 'Ward',
        purchase_date: '2020-01-15',
        specifications: JSON.stringify({ details: [{ id: 'd1', assetCode: 'A002-1', inventoryName: 'Stretcher B - Unit 1', condition: 'baik', status: 'in_use', purchaseDate: '2020-01-15' }] })
      }
    ];
  };

  // @ts-ignore
  dssService.getUsageCounts = async () => {
    return new Map([
      ['medical|1|d1', 50],
      ['non_medical|2|d1', 10]
    ]);
  };

  // @ts-ignore
  dssService.getMaintenanceCounts = async () => {
    return new Map([
      ['medical|1|d1', 3],
      ['non_medical|2|d1', 1]
    ]);
  };

  try {
    const result = await dssService.rankAssets({ assetType: 'all', limit: 10 });
    console.log('DSS debug result:');
    console.dir(result, { depth: 5 });
  } catch (err) {
    console.error('Error running debug dss:', err);
  }
}

void run();
