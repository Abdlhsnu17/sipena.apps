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
    mockedQuery.mockResolvedValue([[{ count: 0 }]]);
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
    mockedQuery.mockResolvedValue([[{ count: 0 }]]);
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

  it('falls back to master availability when completed detail cannot be matched', async () => {
    mockedQuery.mockResolvedValue([[{ count: 0 }]]);
    const assetService = (service as any).assetService;
    jest.spyOn(assetService, 'getById').mockResolvedValue({
      success: true,
      data: {
        id: 12,
        status: 'borrowed',
        specifications: {
          details: [
            {
              id: 'different-detail',
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
        status: 'available',
        condition: 'good',
      },
      'medical'
    );
  });

  it('does not release the asset while another usage log is still active', async () => {
    mockedQuery.mockResolvedValue([[{ count: 1 }]]);
    const assetService = (service as any).assetService;
    const getByIdSpy = jest.spyOn(assetService, 'getById');
    const updateSpy = jest.spyOn(assetService, 'update');

    await (service as any).syncAssetStateAfterUsage(12, 'medical', {
      usageId: 3,
      detailId: 'detail-1',
      conditionAfter: 'Baik',
      endedAt: '2026-05-23 10:00:00',
    });

    expect(getByIdSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
