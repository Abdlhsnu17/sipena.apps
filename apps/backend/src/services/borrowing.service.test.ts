import { beforeEach, describe, expect, it, vi } from 'vitest';

const notificationCreate = vi.fn();
vi.mock('./notification.service', () => ({
  default: { create: (...args: unknown[]) => notificationCreate(...args) },
}));

import {
  BorrowingService,
  getRoleLabel,
  normalizeBorrowingDateFields,
  normalizeComparableText,
  normalizeDateInput,
  normalizeOptionalText,
} from './borrowing.service';

// getOverdueBorrowingInfo bersifat private; diakses lewat `as any` mengikuti pola
// yang sudah dipakai pada test SLA pemeliharaan, agar aturan sanksi keterlambatan
// bisa diuji tanpa menjadikannya bagian dari API publik service.
type BorrowingServiceInternals = {
  getOverdueBorrowingInfo: (
    dueDate?: Date | string | null,
    referenceDate?: Date
  ) => {
    overdueDays: number;
    sanctionStatus: 'none' | 'active' | 'resolved';
    sanctionNotes: string | null;
    sanctionAppliedAt: Date | null;
  };
};

const asInternals = (service: BorrowingService): BorrowingServiceInternals =>
  service as unknown as BorrowingServiceInternals;

describe('BorrowingService aturan sanksi keterlambatan', () => {
  const service = asInternals(new BorrowingService());

  it('tidak memberi sanksi ketika pengembalian tepat waktu', () => {
    const due = new Date('2026-07-18T17:00:00');
    const returnedAt = new Date('2026-07-18T15:00:00');
    const info = service.getOverdueBorrowingInfo(due, returnedAt);

    expect(info.overdueDays).toBe(0);
    expect(info.sanctionStatus).toBe('none');
    expect(info.sanctionNotes).toBeNull();
    expect(info.sanctionAppliedAt).toBeNull();
  });

  it('tidak memberi sanksi ketika tidak ada tanggal jatuh tempo', () => {
    const info = service.getOverdueBorrowingInfo(null, new Date('2026-07-30T09:00:00'));

    expect(info.overdueDays).toBe(0);
    expect(info.sanctionStatus).toBe('none');
  });

  it('tidak memberi sanksi tepat pada batas jatuh tempo', () => {
    const due = new Date('2026-07-18T17:00:00');
    const info = service.getOverdueBorrowingInfo(due, due);

    expect(info.overdueDays).toBe(0);
    expect(info.sanctionStatus).toBe('none');
  });

  it('mengaktifkan sanksi 1 hari untuk keterlambatan kurang dari 24 jam', () => {
    const due = new Date('2026-07-18T17:00:00');
    const returnedAt = new Date('2026-07-18T18:00:00'); // terlambat 1 jam
    const info = service.getOverdueBorrowingInfo(due, returnedAt);

    // Keterlambatan sekecil apa pun dihitung minimal 1 hari.
    expect(info.overdueDays).toBe(1);
    expect(info.sanctionStatus).toBe('active');
    expect(info.sanctionNotes).toBe('Terlambat 1 hari');
    expect(info.sanctionAppliedAt).toBe(returnedAt);
  });

  it('menghitung jumlah hari keterlambatan dan menuliskannya di catatan sanksi', () => {
    const due = new Date('2026-07-18T09:00:00');
    const returnedAt = new Date('2026-07-21T09:00:00'); // terlambat 3 hari
    const info = service.getOverdueBorrowingInfo(due, returnedAt);

    expect(info.overdueDays).toBe(3);
    expect(info.sanctionStatus).toBe('active');
    expect(info.sanctionNotes).toBe('Terlambat 3 hari');
  });

  it('memakai tanggal acuan sebagai waktu penerapan sanksi', () => {
    const due = new Date('2026-07-01T09:00:00');
    const referenceDate = new Date('2026-07-05T09:00:00');
    const info = service.getOverdueBorrowingInfo(due, referenceDate);

    expect(info.sanctionAppliedAt).toBe(referenceDate);
    expect(info.overdueDays).toBe(4);
  });

  it('menerima tanggal jatuh tempo berformat string MySQL', () => {
    const info = service.getOverdueBorrowingInfo(
      '2026-07-18 09:00:00',
      new Date('2026-07-20T09:00:00')
    );

    expect(info.overdueDays).toBe(2);
    expect(info.sanctionStatus).toBe('active');
  });

  it('tidak pernah menetapkan status resolved secara otomatis', () => {
    // 'resolved' hanya boleh terjadi lewat tindakan admin di SanctionsService,
    // bukan sebagai hasil perhitungan keterlambatan.
    const due = new Date('2026-07-01T09:00:00');
    const info = service.getOverdueBorrowingInfo(due, new Date('2026-08-01T09:00:00'));

    expect(info.sanctionStatus).toBe('active');
    expect(info.sanctionStatus).not.toBe('resolved');
  });
});

describe('normalizeDateInput', () => {
  it('returns undefined for empty/nullish input', () => {
    expect(normalizeDateInput(undefined)).toBeUndefined();
    expect(normalizeDateInput('')).toBeUndefined();
    expect(normalizeDateInput('   ')).toBeUndefined();
  });

  it('parses "YYYY-MM-DD HH:mm:ss" as local time, not UTC', () => {
    const parsed = normalizeDateInput('2026-07-18 09:30:00');
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(6);
    expect(parsed?.getDate()).toBe(18);
    expect(parsed?.getHours()).toBe(9);
    expect(parsed?.getMinutes()).toBe(30);
  });

  it('treats "T" separator the same as a space', () => {
    const withT = normalizeDateInput('2026-07-18T09:30:00');
    const withSpace = normalizeDateInput('2026-07-18 09:30:00');
    expect(withT?.getTime()).toBe(withSpace?.getTime());
  });

  it('passes an existing valid Date through unchanged, and rejects an invalid one', () => {
    const date = new Date('2026-01-01');
    expect(normalizeDateInput(date)).toBe(date);
    expect(normalizeDateInput(new Date('not-a-date'))).toBeUndefined();
  });

  it('falls back to native parsing for other recognizable formats', () => {
    const parsed = normalizeDateInput('2026-07-18');
    expect(parsed).toBeInstanceOf(Date);
  });
});

describe('normalizeOptionalText', () => {
  it('returns null for non-string, empty, or whitespace-only values', () => {
    expect(normalizeOptionalText(undefined)).toBeNull();
    expect(normalizeOptionalText(null)).toBeNull();
    expect(normalizeOptionalText('   ')).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeOptionalText('  Ruang ICU  ')).toBe('Ruang ICU');
  });
});

describe('normalizeComparableText', () => {
  it('lowercases, trims, and collapses internal whitespace for comparisons', () => {
    expect(normalizeComparableText('  Ruang    ICU  ')).toBe('ruang icu');
    expect(normalizeComparableText(undefined)).toBe('');
  });
});

describe('getRoleLabel', () => {
  it('maps known role codes to their Indonesian display label', () => {
    expect(getRoleLabel('admin')).toBe('Administrator');
    expect(getRoleLabel('leader')).toBe('Leader');
    expect(getRoleLabel('staff')).toBe('Staff Pelayanan');
    expect(getRoleLabel('staff_pj')).toBe('Staff PJ');
    expect(getRoleLabel('staff-pj')).toBe('Staff PJ');
    expect(getRoleLabel('teknisi')).toBe('Teknisi');
  });

  it('falls back to a generic label for unknown or missing roles', () => {
    expect(getRoleLabel(undefined)).toBe('Pengguna');
    expect(getRoleLabel('')).toBe('Pengguna');
    expect(getRoleLabel('unknown_role')).toBe('Pengguna');
  });
});

describe('normalizeBorrowingDateFields', () => {
  it('formats known date fields into MySQL DATETIME strings and leaves the rest untouched', () => {
    const row = {
      id: 1,
      borrow_date: '2026-07-18T09:30:00',
      due_date: undefined,
      note: 'catatan bebas',
    };

    const normalized = normalizeBorrowingDateFields(row);

    expect(normalized.borrow_date).toBe('2026-07-18 09:30:00');
    expect(normalized.due_date).toBeUndefined();
    expect(normalized.note).toBe('catatan bebas');
    expect(normalized.id).toBe(1);
  });
});

describe('BorrowingService notifikasi sanksi', () => {
  type NotifyInternals = {
    notifyNewSanctions: (rows: Record<string, unknown>[]) => void;
  };

  const service = new BorrowingService() as unknown as NotifyInternals;

  beforeEach(() => {
    notificationCreate.mockClear();
  });

  it('memberi tahu peminjam beserta jumlah hari keterlambatan', () => {
    service.notifyNewSanctions([
      {
        id: 42,
        user_id: 7,
        borrowing_code: 'PJM-2026-0042',
        asset_detail_name: 'Infusion Pump',
        asset_detail_code: 'MED-011',
        due_date: new Date(Date.now() - 3 * 86400000),
      },
    ]);

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    const payload = notificationCreate.mock.calls[0][0];
    expect(payload).toMatchObject({
      userId: 7,
      type: 'sanction_applied',
      category: 'borrowing',
      referenceId: 42,
    });
    expect(payload.message).toContain('Infusion Pump');
    expect(payload.message).toContain('terlambat 3 hari');
    // Halaman /sanctions hanya untuk admin dan leader, sedangkan penerima
    // notifikasi ini peminjamnya sendiri.
    expect(payload.link).toBe('/borrowing');
  });

  it('melewati baris tanpa pemilik yang sah', () => {
    service.notifyNewSanctions([
      { id: 1, user_id: 0 },
      { id: 2, user_id: null as unknown as number },
    ]);

    expect(notificationCreate).not.toHaveBeenCalled();
  });
});
