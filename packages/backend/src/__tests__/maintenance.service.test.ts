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
});
