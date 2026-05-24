import pool from '../config/database';
import { ensureAssetUsageLogsTable } from '../utils/schema';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

describe('ensureAssetUsageLogsTable', () => {
  const mockedQuery = pool.query as jest.Mock;

  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('repairs older asset usage tables missing no and borrowing_id columns', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SHOW TABLES LIKE 'asset_usage_logs'")) {
        return [[{ Tables_in_test: 'asset_usage_logs' }]];
      }

      if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
        return [[{ COLUMN_NAME: 'id' }]];
      }

      if (sql.startsWith('SHOW INDEX FROM')) {
        return [[]];
      }

      return [{}];
    });

    await ensureAssetUsageLogsTable();

    const executedSql = mockedQuery.mock.calls.map(([sql]) => sql);
    expect(executedSql).toContain('ALTER TABLE asset_usage_logs ADD COLUMN `no` VARCHAR(50) DEFAULT NULL AFTER `id`');
    expect(executedSql).toContain('CREATE UNIQUE INDEX uniq_asset_usage_no ON asset_usage_logs (`no`)');
    expect(executedSql).toContain('ALTER TABLE asset_usage_logs ADD COLUMN borrowing_id INT(11) DEFAULT NULL AFTER `no`');
    expect(executedSql).toContain('CREATE INDEX idx_asset_usage_borrowing ON asset_usage_logs (borrowing_id)');
  });
});
