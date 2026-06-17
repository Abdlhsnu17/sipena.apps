import pool from '../config/database';
import { AssetService } from '../services/asset.service';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

describe('AssetService stale detail status reconciliation', () => {
  const mockedQuery = pool.query as jest.Mock;
  let service: AssetService;

  beforeEach(() => {
    mockedQuery.mockReset();
    service = new AssetService();
  });

  it('releases stale borrowed detail status when no active borrowing or usage exists', async () => {
    const row = {
      id: 12,
      specifications: {
        details: [
          {
            id: 'NMD-ANGPTH-AHU',
            assetCode: 'NMD-ANGPTH-AHU',
            name: 'Air Handling Unit (AHU)',
            status: 'Dipinjam',
            condition: 'Baik',
          },
        ],
      },
    };

    mockedQuery
      .mockResolvedValueOnce([[{ count: 0 }], []])
      .mockResolvedValueOnce([[{ count: 0 }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    await (service as any).reconcileStaleUsageDetailStatuses([row], 'non_medical');

    expect(mockedQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE non_medical_assets SET specifications = ?'),
      [
        JSON.stringify({
          details: [
            {
              id: 'NMD-ANGPTH-AHU',
              assetCode: 'NMD-ANGPTH-AHU',
              name: 'Air Handling Unit (AHU)',
              status: 'Aktif',
              condition: 'Baik',
            },
          ],
        }),
        12,
      ]
    );
    expect(row.specifications).toEqual({
      details: [
        {
          id: 'NMD-ANGPTH-AHU',
          assetCode: 'NMD-ANGPTH-AHU',
          name: 'Air Handling Unit (AHU)',
          status: 'Aktif',
          condition: 'Baik',
        },
      ],
    });
  });
});
