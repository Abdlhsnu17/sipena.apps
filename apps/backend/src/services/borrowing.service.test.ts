import { describe, expect, it } from 'vitest';
import {
  getRoleLabel,
  normalizeBorrowingDateFields,
  normalizeComparableText,
  normalizeDateInput,
  normalizeOptionalText,
} from './borrowing.service';

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
