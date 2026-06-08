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

  it('matches completed detail usage by inventory name when id and code differ', async () => {
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
              inventoryName: 'Oxygen Flowmeter & Humidifier',
              assetCode: 'MED-ANGH-OXY',
              status: 'Sedang Digunakan',
              condition: 'Baik',
            },
          ],
        },
      },
    });
    const updateSpy = jest.spyOn(assetService, 'update').mockResolvedValue({ success: true });

    await (service as any).syncAssetStateAfterUsage(12, 'medical', {
      detailId: 'IMD-DTL-ANG1-08',
      detailName: 'Oxygen Flowmeter & Humidifier',
      conditionAfter: 'Baik',
      endedAt: '2026-05-23 10:00:00',
    });

    expect(updateSpy).toHaveBeenCalledWith(
      '12',
      {
        specifications: {
          details: [
            {
              id: 'different-detail',
              inventoryName: 'Oxygen Flowmeter & Humidifier',
              assetCode: 'MED-ANGH-OXY',
              status: 'Aktif',
              condition: 'Baik',
            },
          ],
        },
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

  it('keeps usage completion successful when borrowing return sync fails', async () => {
    const activeLog = {
      id: 7,
      assetId: 12,
      assetType: 'medical',
      roomName: 'Ruangan Anggrek',
      usageContext: 'procedure',
      startedAt: '2026-05-23 09:00:00',
      endedAt: null,
      usageCount: 1,
      createdBy: 1,
    };
    const completedLog = {
      ...activeLog,
      endedAt: '2026-05-23 10:00:00',
      conditionAfter: 'Baik',
      notes: 'Selesai',
    };

    mockedQuery
      .mockResolvedValueOnce([[activeLog]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[completedLog]])
      .mockResolvedValueOnce([[completedLog]]);

    jest.spyOn(service as any, 'syncAssetStateAfterUsage').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'syncBorrowingReturnAfterUsageComplete').mockRejectedValue(new Error('sync failed'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await service.update('7', {
      endedAt: '2026-05-23 10:00:00',
      conditionAfter: 'Baik',
      notes: 'Selesai',
    });

    expect(result.success).toBe(true);
    expect(result.data?.endedAt).toBe('2026-05-23T10:00:00');
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to sync borrowing return after usage completion:',
      expect.any(Error)
    );

    warnSpy.mockRestore();
  });

  it('skips sub-room validation for usage logs generated from borrowing', async () => {
    const validateSpy = jest.spyOn(service as any, 'validateUsageSubRoomAccess');
    jest.spyOn(service as any, 'markAssetDetailInUse').mockResolvedValue(undefined);
    jest.spyOn(service, 'getById').mockResolvedValue({
      success: true,
      message: 'Asset usage log retrieved successfully',
      data: {
        id: 11,
        borrowingId: 42,
        assetId: 12,
        assetType: 'medical',
        roomName: 'IGD Lt 4',
        usageContext: 'other',
        startedAt: new Date('2026-05-23T09:00:00'),
        usageCount: 1,
        createdBy: 5,
      },
    });
    mockedQuery.mockResolvedValueOnce([{ insertId: 11 }]);

    const result = await service.create(
      {
        borrowingId: 42,
        assetId: 12,
        assetType: 'medical',
        roomName: 'IGD Lt 4',
        operatorUserId: 5,
        usageContext: 'other',
        startedAt: '2026-05-23 09:00:00',
        createdBy: 5,
      },
      { skipSubRoomValidation: true }
    );

    expect(result.success).toBe(true);
    expect(validateSpy).not.toHaveBeenCalled();
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO asset_usage_logs'),
      expect.arrayContaining([42, 12, 'medical', 'IGD Lt 4'])
    );
  });

  it('still applies sub-room validation for manually created usage logs', async () => {
    jest.spyOn(service as any, 'validateUsageSubRoomAccess').mockResolvedValue({
      success: false,
      message: 'Sub ruangan akun belum diisi, sehingga alat penggunaan tidak dapat dipilih.',
    });

    const result = await service.create({
      assetId: 12,
      assetType: 'medical',
      roomName: 'IGD Lt 4',
      startedAt: '2026-05-23 09:00:00',
      createdBy: 5,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Sub ruangan');
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
