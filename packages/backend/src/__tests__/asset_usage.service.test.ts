import pool from '../config/database';
import { AssetUsageService } from '../services/asset_usage.service';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

describe('AssetUsageService usage completion status sync', () => {
  const mockedQuery = pool.query as jest.Mock;
  let service: AssetUsageService;

  beforeEach(() => {
    mockedQuery.mockReset();
    service = new AssetUsageService();
  });

  it('sets a completed medical detail usage back to Aktif', async () => {
    const assetService = (service as any).assetService;
    jest.spyOn(assetService, 'getById').mockResolvedValue({
      success: true,
      data: {
        id: 12,
        status: 'available',
        specifications: {
          details: [
            {
              id: 'detail-1',
              name: 'Infusion Pump Unit 1',
              status: 'Sedang Digunakan',
              condition: 'Baik',
            },
          ],
        },
      },
    });
    const updateSpy = jest.spyOn(assetService, 'update').mockResolvedValue({ success: true });

    await (service as any).syncAssetStateAfterUsage(12, 'medical', {
      detailId: 'detail-1',
      conditionAfter: 'Baik',
      endedAt: '2026-05-23 10:00:00',
    });

    expect(updateSpy).toHaveBeenCalledWith(
      '12',
      {
        specifications: {
          details: [
            {
              id: 'detail-1',
              name: 'Infusion Pump Unit 1',
              status: 'Aktif',
              condition: 'Baik',
            },
          ],
        },
      },
      'medical'
    );
  });

  it('sets a completed non-medical master usage back to available', async () => {
    const assetService = (service as any).assetService;
    jest.spyOn(assetService, 'getById').mockResolvedValue({
      success: true,
      data: {
        id: 21,
        status: 'borrowed',
        specifications: { details: [] },
      },
    });
    const updateSpy = jest.spyOn(assetService, 'update').mockResolvedValue({ success: true });

    await (service as any).syncAssetStateAfterUsage(21, 'non_medical', {
      endedAt: '2026-05-23 10:00:00',
      conditionAfter: 'Baik',
    });

    expect(updateSpy).toHaveBeenCalledWith(
      '21',
      {
        status: 'available',
        condition: 'good',
      },
      'non_medical'
    );
  });
});
