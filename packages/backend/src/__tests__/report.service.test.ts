import pool from '../config/database';
import { ReportService } from '../services/report.service';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

describe('ReportService.getAssetReport', () => {
  const mockedQuery = pool.query as jest.Mock;
  let service: ReportService;

  beforeEach(() => {
    mockedQuery.mockReset();
    service = new ReportService();
  });

  it('does not filter asset master data by report period', async () => {
    mockedQuery.mockResolvedValueOnce([
      [
        {
          id: 1,
          asset_code: 'MED-ROOM-001',
          name: 'Ruang Medis',
          category: 'Medis',
          type: 'medical',
          status: 'available',
          condition: 'good',
          location: 'Ruang Medis',
          specifications: JSON.stringify({
            details: [
              {
                id: 'MED-01',
                assetCode: 'MED-ITEM-001',
                inventoryName: 'Patient Monitor',
                status: 'Aktif',
                condition: 'Baik',
                roomId: '1',
              },
            ],
          }),
          total_borrowings: 0,
          total_maintenance: 0,
        },
      ],
      [],
    ]);

    const result = await service.getAssetReport({
      startDate: '2026-06-06',
      endDate: '2026-06-08',
      type: 'medical',
    });

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [query, params] = mockedQuery.mock.calls[0];

    expect(String(query)).not.toContain('a.created_at >=');
    expect(String(query)).not.toContain('a.created_at <=');
    expect(String(query)).toContain('AND a.type = ?');
    expect(params).toEqual(['medical']);
    expect(result.data).toEqual([
      expect.objectContaining({
        id: 'MED-01',
        asset_id: 1,
        asset_code: 'MED-ITEM-001',
        asset_name: 'Ruang Medis',
        name: 'Patient Monitor',
        type: 'medical',
        status: 'Aktif',
        location: 'Ruang Medis',
      }),
    ]);
  });

  it('exports non-medical specification details as inventory rows', async () => {
    mockedQuery.mockResolvedValueOnce([
      [
        {
          id: 2,
          asset_code: 'NMD-ROOM-001',
          name: 'Ruang Non Medis',
          category: 'Non Medis',
          type: 'non_medical',
          status: 'available',
          condition: 'good',
          location: 'Ruang Non Medis',
          specifications: JSON.stringify({
            details: [
              {
                id: 'NMD-01',
                assetCode: 'NMD-ITEM-001',
                inventoryName: 'Air Conditioner Split',
                brandModel: 'Daikin',
                serialNumber: 'SN-001',
                status: 'Aktif',
                condition: 'Baik',
              },
            ],
          }),
          brand: null,
          model: null,
          serial_number: null,
          usage_purpose: 'Fasilitas Umum',
          total_borrowings: 0,
          total_maintenance: 0,
        },
      ],
      [],
    ]);

    const result = await service.getAssetReport({ type: 'non_medical' });
    const [query] = mockedQuery.mock.calls[0];

    expect(String(query)).toContain('warranty_expiry, specifications');
    expect(String(query)).not.toContain('NULL as specifications');
    expect(result.data).toEqual([
      expect.objectContaining({
        id: 'NMD-01',
        asset_id: 2,
        asset_code: 'NMD-ITEM-001',
        name: 'Air Conditioner Split',
        type: 'non_medical',
        brand_model: 'Daikin',
        serial_number: 'SN-001',
      }),
    ]);
  });
});
