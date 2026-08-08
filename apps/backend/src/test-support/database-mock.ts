import { vi } from 'vitest';

/**
 * Pengganti pool MySQL untuk test integrasi HTTP.
 *
 * Test mendaftarkan pencocok terhadap SQL yang dijalankan service, sehingga
 * logika service tetap berjalan apa adanya tanpa perlu database sungguhan.
 * Query yang tidak dikenali sengaja dilempar sebagai error agar test tidak
 * lolos diam-diam saat sebuah alur ternyata menyentuh tabel tak terduga.
 *
 * Modul ini singleton: `vi.mock('../config/database')` mengembalikan `poolMock`
 * yang sama dengan yang diprogram test lewat `onQuery`.
 */
export interface QueryHandler {
  matcher: RegExp;
  /** Baris hasil, atau fungsi untuk membuatnya dari SQL dan parameter. */
  rows: unknown | ((sql: string, params: unknown[]) => unknown);
}

const handlers: QueryHandler[] = [];
const executed: { sql: string; params: unknown[] }[] = [];

const resolveRows = (handler: QueryHandler, sql: string, params: unknown[]): unknown =>
  typeof handler.rows === 'function'
    ? (handler.rows as (sql: string, params: unknown[]) => unknown)(sql, params)
    : handler.rows;

const runQuery = async (sql: unknown, params: unknown = []): Promise<[unknown, unknown[]]> => {
  const sqlText = typeof sql === 'string' ? sql : String((sql as { sql?: string })?.sql ?? sql);
  const parameters = Array.isArray(params) ? params : [params];
  executed.push({ sql: sqlText, params: parameters });

  const handler = handlers.find((candidate) => candidate.matcher.test(sqlText));
  if (!handler) {
    throw new Error(
      `Query tidak terduga dalam test (tidak ada pencocok terdaftar):\n${sqlText.trim().slice(0, 400)}`,
    );
  }

  return [resolveRows(handler, sqlText, parameters), []];
};

const connection = {
  query: vi.fn(runQuery),
  execute: vi.fn(runQuery),
  beginTransaction: vi.fn(async () => undefined),
  commit: vi.fn(async () => undefined),
  rollback: vi.fn(async () => undefined),
  release: vi.fn(() => undefined),
};

export const poolMock = {
  query: vi.fn(runQuery),
  execute: vi.fn(runQuery),
  getConnection: vi.fn(async () => connection),
  end: vi.fn(async () => undefined),
};

/**
 * Mendaftarkan hasil untuk query yang cocok dengan `matcher`.
 * Pencocok dievaluasi berurutan, jadi daftarkan yang paling spesifik lebih dulu.
 */
export const onQuery = (matcher: RegExp, rows: QueryHandler['rows']): void => {
  handlers.push({ matcher, rows });
};

/** SQL yang benar-benar dijalankan, untuk asersi bahwa filter ikut terkirim. */
export const executedQueries = (): readonly { sql: string; params: unknown[] }[] => executed;

export const resetDatabaseMock = (): void => {
  handlers.length = 0;
  executed.length = 0;
  poolMock.query.mockClear();
  poolMock.execute.mockClear();
  poolMock.getConnection.mockClear();
  connection.query.mockClear();
  connection.execute.mockClear();
};

/** Modul `../config/database` tiruan, dipakai di dalam factory `vi.mock`. */
export const databaseModuleMock = () => ({
  default: poolMock,
  connectDatabase: vi.fn(async () => undefined),
  disconnectDatabase: vi.fn(async () => undefined),
});
