import { describe, expect, it } from 'vitest';
import { mapRow } from './sanctions.service';

describe('mapRow (sanksi)', () => {
  it('memberi nilai default aman ketika kolom sanksi masih kosong', () => {
    const record = mapRow({
      id: 7,
      borrowing_code: 'PJ-20260718-0001',
      user_id: 3,
    } as any);

    // overdueDays 0 dan status 'none' penting: tanpa default ini UI bisa
    // menampilkan "NaN hari" atau menganggap sanksi aktif.
    expect(record.overdueDays).toBe(0);
    expect(record.sanctionStatus).toBe('none');
    expect(record.returnDate).toBeUndefined();
    expect(record.resolvedAt).toBeUndefined();
  });

  it('meneruskan sanksi aktif beserta jumlah hari keterlambatannya', () => {
    const record = mapRow({
      id: 8,
      borrowing_code: 'PJ-20260718-0002',
      user_id: 4,
      overdue_days: 3,
      sanction_status: 'active',
      sanction_notes: 'Terlambat 3 hari',
      sanction_applied_at: '2026-07-18 09:00:00',
    } as any);

    expect(record.overdueDays).toBe(3);
    expect(record.sanctionStatus).toBe('active');
    expect(record.sanctionNotes).toBe('Terlambat 3 hari');
    expect(record.sanctionAppliedAt).toBe('2026-07-18 09:00:00');
  });

  it('memetakan penyelesaian sanksi termasuk petugas yang menyelesaikan', () => {
    const record = mapRow({
      id: 9,
      borrowing_code: 'PJ-20260718-0003',
      user_id: 5,
      overdue_days: 2,
      sanction_status: 'resolved',
      resolved_at: '2026-07-20 10:00:00',
      resolved_by_name: 'Admin Sarana',
      resolved_by_user_id: 1,
      resolved_notes: 'Sudah dikembalikan',
    } as any);

    expect(record.sanctionStatus).toBe('resolved');
    expect(record.resolvedBy).toBe('Admin Sarana');
    expect(record.resolvedByUserId).toBe(1);
    expect(record.resolvedNotes).toBe('Sudah dikembalikan');
  });

  it('memakai asset_detail_name sebagai nama aset bila tersedia', () => {
    const record = mapRow({
      id: 10,
      borrowing_code: 'PJ-20260718-0004',
      user_id: 6,
      asset_name: 'Kursi Roda Unit 2',
      asset_code: 'KR-002',
    } as any);

    expect(record.assetName).toBe('Kursi Roda Unit 2');
    expect(record.assetCode).toBe('KR-002');
  });

  it('mengubah null pada kolom opsional menjadi undefined, bukan null', () => {
    const record = mapRow({
      id: 11,
      borrowing_code: 'PJ-20260718-0005',
      user_id: 7,
      return_date: null,
      sanction_notes: null,
      resolved_notes: null,
    } as any);

    expect(record.returnDate).toBeUndefined();
    expect(record.sanctionNotes).toBeUndefined();
    expect(record.resolvedNotes).toBeUndefined();
  });
});
