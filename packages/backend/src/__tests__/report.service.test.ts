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
    mockedQuery.mockResolvedValueOnce([[], []]);

    await service.getAssetReport({
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
  });
});
