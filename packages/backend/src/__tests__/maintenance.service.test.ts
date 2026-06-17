import pool from '../config/database';
import { MaintenanceService } from '../services/maintenance.service';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

describe('MaintenanceService.getAll view filter', () => {
  const mockedQuery = pool.query as jest.Mock;
  let service: MaintenanceService;

  beforeEach(() => {
    mockedQuery.mockReset();
    service = new MaintenanceService();
  });

  it('applies active status set when view=active and no explicit status', async () => {
    mockedQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ count: 0 }], []]);

    await service.getAll({ page: 1, limit: 10, view: 'active' });

    expect(mockedQuery).toHaveBeenCalledTimes(2);

    const [listQuery, listParams] = mockedQuery.mock.calls[0];
    const [countQuery, countParams] = mockedQuery.mock.calls[1];

    expect(String(listQuery)).toContain('m.status IN (?, ?, ?, ?)');
    expect(String(countQuery)).toContain('status IN (?, ?, ?, ?)');
    expect(listParams).toEqual([
      'requested',
      'scheduled',
      'in_progress',
      'completed',
      10,
      0,
    ]);
    expect(countParams).toEqual([
      'requested',
      'scheduled',
      'in_progress',
      'completed',
    ]);
  });

  it('applies history status set when view=history and no explicit status', async () => {
    mockedQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ count: 0 }], []]);

    await service.getAll({ page: 2, limit: 5, view: 'history' });

    const [listQuery, listParams] = mockedQuery.mock.calls[0];
    const [countQuery, countParams] = mockedQuery.mock.calls[1];

    expect(String(listQuery)).toContain('m.status IN (?, ?)');
    expect(String(countQuery)).toContain('status IN (?, ?)');
    expect(listParams).toEqual(['validated', 'cancelled', 5, 5]);
    expect(countParams).toEqual(['validated', 'cancelled']);
  });

  it('prioritizes explicit status over view filter', async () => {
    mockedQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ count: 0 }], []]);

    await service.getAll({ page: 1, limit: 10, view: 'active', status: 'validated' });

    const [listQuery, listParams] = mockedQuery.mock.calls[0];
    const [countQuery, countParams] = mockedQuery.mock.calls[1];

    expect(String(listQuery)).toContain('AND m.status = ?');
    expect(String(listQuery)).not.toContain('m.status IN');
    expect(String(countQuery)).toContain('AND status = ?');
    expect(String(countQuery)).not.toContain('status IN');
    expect(listParams).toEqual(['validated', 10, 0]);
    expect(countParams).toEqual(['validated']);
  });

  it('does not scope technician maintenance list to records they created or completed', async () => {
    mockedQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ count: 0 }], []]);

    await service.getAll({
      page: 1,
      limit: 10,
      view: 'active',
      actorUserId: 17,
      actorRole: 'teknisi',
    });

    const [listQuery, listParams] = mockedQuery.mock.calls[0];
    const [countQuery, countParams] = mockedQuery.mock.calls[1];

    expect(String(listQuery)).not.toContain('m.created_by = ? OR m.completed_by = ?');
    expect(String(countQuery)).not.toContain('created_by = ? OR completed_by = ?');
    expect(listParams).toEqual([
      'requested',
      'scheduled',
      'in_progress',
      'completed',
      10,
      0,
    ]);
    expect(countParams).toEqual([
      'requested',
      'scheduled',
      'in_progress',
      'completed',
    ]);
  });

  it('still scopes non-privileged maintenance list to records they created or completed', async () => {
    mockedQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ count: 0 }], []]);

    await service.getAll({
      page: 1,
      limit: 10,
      view: 'active',
      actorUserId: 17,
      actorRole: 'staff',
    });

    const [listQuery, listParams] = mockedQuery.mock.calls[0];
    const [countQuery, countParams] = mockedQuery.mock.calls[1];

    expect(String(listQuery)).toContain('m.created_by = ? OR m.completed_by = ?');
    expect(String(countQuery)).toContain('created_by = ? OR completed_by = ?');
    expect(listParams).toEqual([
      'requested',
      'scheduled',
      'in_progress',
      'completed',
      17,
      17,
      10,
      0,
    ]);
    expect(countParams).toEqual([
      'requested',
      'scheduled',
      'in_progress',
      'completed',
      17,
      17,
    ]);
  });
});

describe('MaintenanceService active usage lock', () => {
  const mockedQuery = pool.query as jest.Mock;
  let service: MaintenanceService;

  beforeEach(() => {
    mockedQuery.mockReset();
    service = new MaintenanceService();
  });

  it('rejects creating maintenance when the asset has an active usage log', async () => {
    mockedQuery.mockResolvedValueOnce([[{ count: 1 }], []]);

    jest.spyOn((service as any).assetService, 'getById').mockResolvedValue({
      success: true,
      data: {
        id: 42,
        status: 'available',
        specifications: { details: [] },
      },
    });

    const result = await service.create({
      assetId: 42,
      assetType: 'medical',
      assetDetailId: 'detail-1',
      assetDetailName: 'Infusion Pump',
      type: 'preventive',
      status: 'requested',
      scheduledDate: '2026-05-23 10:00:00',
      description: 'Pemeriksaan rutin',
      createdBy: 7,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Alat sedang digunakan');
    expect(result.message).toContain('pemeliharaan');
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it('rejects creating maintenance when the selected detail is marked as in use', async () => {
    jest.spyOn((service as any).assetService, 'getById').mockResolvedValue({
      success: true,
      data: {
        id: 42,
        status: 'available',
        specifications: {
          details: [
            {
              id: 'detail-1',
              name: 'Infusion Pump',
              status: 'Sedang Digunakan',
              condition: 'Baik',
            },
          ],
        },
      },
    });

    const result = await service.create({
      assetId: 42,
      assetType: 'medical',
      assetDetailId: 'detail-1',
      assetDetailName: 'Infusion Pump',
      type: 'preventive',
      status: 'requested',
      scheduledDate: '2026-05-23 10:00:00',
      description: 'Pemeriksaan rutin',
      createdBy: 7,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Alat sedang digunakan');
    expect(result.message).toContain('pemeliharaan');
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
