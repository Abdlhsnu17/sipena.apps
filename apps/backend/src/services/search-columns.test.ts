import { describe, expect, it } from 'vitest';
import { BORROWING_LOCK_CONDITION, BORROWING_SEARCH_COLUMNS } from './borrowing.service';
import { MAINTENANCE_SEARCH_COLUMNS } from './maintenance.service';

/**
 * Test ini mengikat keputusan pemetaan antara pencarian sisi server dan daftar
 * nilai yang sebelumnya dicocokkan di browser. Bila kolom pencarian diubah tanpa
 * sadar, hasil yang dilihat pengguna bisa bergeser tanpa terdeteksi.
 */
describe('BORROWING_SEARCH_COLUMNS', () => {
  const joined = BORROWING_SEARCH_COLUMNS.join(' | ');

  it('mencari No ID maupun kode peminjaman', () => {
    expect(joined).toContain("CONCAT('PMJ-'");
    expect(joined).toContain('b.borrowing_code');
  });

  it('mengolapskan nama detail dan nama aset menjadi satu nilai seperti di tabel', () => {
    // Tabel menampilkan `assetDetailName || assetName`. Bila dicari terpisah,
    // sebuah baris bisa muncul karena nama aset induk yang tidak tampil.
    expect(joined).toContain("COALESCE(NULLIF(b.asset_detail_name, ''), ma.name, na.name)");
    expect(BORROWING_SEARCH_COLUMNS).not.toContain('b.asset_detail_name');
    expect(BORROWING_SEARCH_COLUMNS).not.toContain('COALESCE(ma.name, na.name)');
  });

  it('mencari kode detail dan kode aset secara terpisah, sesuai perilaku tabel', () => {
    expect(BORROWING_SEARCH_COLUMNS).toContain('b.asset_detail_code');
    expect(BORROWING_SEARCH_COLUMNS).toContain('COALESCE(ma.asset_code, na.asset_code)');
  });

  it('mencakup identitas peminjam, pemilik, keperluan, dan catatan', () => {
    for (const column of [
      'u.name',
      'u.nip',
      'b.borrower_position',
      'b.borrower_work_unit',
      'b.owner_name',
      'b.owner_work_unit',
      'b.purpose',
      'b.destination_room',
      'b.notes',
    ]) {
      expect(BORROWING_SEARCH_COLUMNS).toContain(column);
    }
  });

  it('tidak memuat kolom duplikat', () => {
    expect(new Set(BORROWING_SEARCH_COLUMNS).size).toBe(BORROWING_SEARCH_COLUMNS.length);
  });
});

describe('BORROWING_LOCK_CONDITION', () => {
  it('mencakup status aktif dan pengembalian yang belum divalidasi', () => {
    expect(BORROWING_LOCK_CONDITION).toContain("'pending', 'approved', 'borrowed', 'overdue'");
    expect(BORROWING_LOCK_CONDITION).toContain("b.status = 'returned' AND b.return_validated_at IS NULL");
  });

  it('tidak mencakup peminjaman yang sudah divalidasi atau ditolak', () => {
    expect(BORROWING_LOCK_CONDITION).not.toContain("'rejected'");
  });
});

describe('MAINTENANCE_SEARCH_COLUMNS', () => {
  const joined = MAINTENANCE_SEARCH_COLUMNS.join(' | ');

  it('mencari No ID tiket, kode tiket, dan No ID aset', () => {
    expect(joined).toContain("CONCAT('JDW-'");
    expect(joined).toContain('m.maintenance_code');
    expect(joined).toContain("CONCAT('AST-'");
  });

  it('mencari nama detail dan nama aset secara terpisah, sesuai perilaku kartu', () => {
    expect(MAINTENANCE_SEARCH_COLUMNS).toContain('m.asset_detail_name');
    expect(MAINTENANCE_SEARCH_COLUMNS).toContain('COALESCE(ma.name, na.name)');
  });

  it('mencakup identitas pemohon', () => {
    expect(MAINTENANCE_SEARCH_COLUMNS).toContain('u.name');
    expect(MAINTENANCE_SEARCH_COLUMNS).toContain('u.nip');
  });

  it('tidak memuat kolom duplikat', () => {
    expect(new Set(MAINTENANCE_SEARCH_COLUMNS).size).toBe(MAINTENANCE_SEARCH_COLUMNS.length);
  });
});
