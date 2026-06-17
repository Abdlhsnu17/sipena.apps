import pool from '../config/database';
import { UserActivityService } from '../services/user_activity.service';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

describe('UserActivityService', () => {
  const mockedQuery = pool.query as jest.Mock;
  let service: UserActivityService;

  beforeEach(() => {
    mockedQuery.mockReset();
    service = new UserActivityService();
  });

  it('ignores non-object metadata JSON when mapping activity rows', async () => {
    mockedQuery.mockResolvedValueOnce([
      [
        {
          id: 1,
          user_id: 7,
          user_name: 'Operator',
          user_nip: '12345678',
          feature: 'unggahan',
          action: 'upload',
          description: 'Unggah dokumen',
          metadata_json: '["not-an-object"]',
          created_at: new Date('2026-06-17T08:00:00Z'),
        },
      ],
    ]);

    const result = await service.getByUserId(7);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]).toMatchObject({
      id: 1,
      userId: 7,
      metadata: null,
    });
  });

  it('only applies valid YYYY-MM-DD date filters to activity archive queries', async () => {
    mockedQuery
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[]]);

    const result = await service.getActivities({
      actorUserId: 1,
      actorRole: 'admin',
      startDate: 'not-a-date',
      endDate: '2026-06-17',
      page: 2,
      limit: 5,
    });

    expect(result.success).toBe(true);
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedQuery.mock.calls[0][1]).toEqual(['2026-06-17']);
    expect(mockedQuery.mock.calls[1][1]).toEqual(['2026-06-17', 5, 5]);
    expect(mockedQuery.mock.calls[0][0]).not.toContain('DATE(ual.created_at) >= ?');
    expect(mockedQuery.mock.calls[0][0]).toContain('DATE(ual.created_at) <= ?');
  });
});
