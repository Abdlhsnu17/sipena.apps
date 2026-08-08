import { onQuery } from './database-mock';

/**
 * Baris `borrowing_records` seperti yang dikembalikan query gabungan di
 * `BorrowingService.getAll`, lengkap dengan kolom hasil JOIN.
 */
export const createBorrowingRow = (overrides: Record<string, unknown> = {}) => ({
  id: 42,
  borrowing_code: 'PJM-2026-0042',
  asset_id: 11,
  asset_type: 'medical',
  user_id: 7,
  asset_name: 'Infusion Pump',
  asset_code: 'MED-011',
  user_name: 'Siti Rahmawati',
  user_nip: '199203102019031005',
  borrow_date: new Date('2026-08-01T02:00:00.000Z'),
  due_date: new Date('2026-08-08T02:00:00.000Z'),
  return_date: null,
  status: 'borrowed',
  purpose: 'Perawatan pasien ruang melati',
  quantity: 1,
  overdue_days: 0,
  sanction_status: 'none',
  extension_count: 0,
  created_at: new Date('2026-08-01T02:00:00.000Z'),
  updated_at: new Date('2026-08-01T02:00:00.000Z'),
  deleted_at: null,
  ...overrides,
});

/**
 * Mendaftarkan seluruh query yang dilewati `GET /api/borrowing`, berurutan dari
 * yang paling spesifik.
 *
 * Selain query data dan hitung, endpoint ini lebih dulu memeriksa ketersediaan
 * kolom sanksi lewat information_schema dan menyegarkan status terlambat. Kedua
 * query itu memakai pola SQL yang mirip dengan query hitung, jadi urutan
 * pendaftaran di sini penting.
 */
export const stubBorrowingListQueries = (rows: unknown[], total = rows.length): void => {
  onQuery(/information_schema\.columns/, [{ count: 4 }]);
  onQuery(/UPDATE borrowing_records[\s\S]*SET status = 'overdue'/, { affectedRows: 0 });
  onQuery(/SELECT COUNT\(\*\) as count[\s\S]*FROM borrowing_records b/, [{ count: total }]);
  onQuery(/FROM borrowing_records b/, rows);
};
