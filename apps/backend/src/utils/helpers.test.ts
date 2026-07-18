import { describe, expect, it } from 'vitest';
import {
  buildOverdueSanctionNote,
  daysBetween,
  formatCostLabel,
  formatDateTimeForMySQL,
  getOverdueDays,
  isOverdue,
  paginate,
  sanitizeString,
} from './helpers';

describe('formatCostLabel', () => {
  it('returns dash for missing or non-positive cost', () => {
    expect(formatCostLabel(undefined)).toBe('-');
    expect(formatCostLabel(0)).toBe('-');
    expect(formatCostLabel(-100)).toBe('-');
  });

  it('formats known round values in Indonesian words', () => {
    expect(formatCostLabel(1000)).toBe('seribu rupiah');
    expect(formatCostLabel(100000)).toBe('seratus ribu rupiah');
    expect(formatCostLabel(1000000)).toBe('satu juta rupiah');
  });

  it('formats arbitrary round millions and thousands', () => {
    expect(formatCostLabel(5000000)).toBe('5 juta rupiah');
    expect(formatCostLabel(2000)).toBe('2 ribu rupiah');
  });

  it('falls back to Rupiah formatting for non-round values', () => {
    expect(formatCostLabel(1234)).toBe(`Rp${(1234).toLocaleString('id-ID')}`);
  });
});

describe('daysBetween', () => {
  it('calculates whole days between two dates regardless of order', () => {
    expect(daysBetween('2026-07-01', '2026-07-05')).toBe(4);
    expect(daysBetween('2026-07-05', '2026-07-01')).toBe(4);
  });

  it('rounds up partial days', () => {
    expect(daysBetween('2026-07-01T00:00:00', '2026-07-01T12:00:00')).toBe(1);
  });
});

describe('isOverdue', () => {
  it('returns false when no due date is given', () => {
    expect(isOverdue(null)).toBe(false);
    expect(isOverdue(undefined)).toBe(false);
  });

  it('returns true only when due date is in the past', () => {
    const past = new Date(Date.now() - 1000 * 60 * 60);
    const future = new Date(Date.now() + 1000 * 60 * 60);
    expect(isOverdue(past)).toBe(true);
    expect(isOverdue(future)).toBe(false);
  });
});

describe('getOverdueDays', () => {
  it('returns 0 when there is no due date or the reference is not past due', () => {
    expect(getOverdueDays(null)).toBe(0);
    const due = new Date('2026-07-10T00:00:00');
    const reference = new Date('2026-07-09T00:00:00');
    expect(getOverdueDays(due, reference)).toBe(0);
  });

  it('returns at least 1 day once overdue, rounded up', () => {
    const due = new Date('2026-07-01T00:00:00');
    const reference = new Date('2026-07-01T01:00:00');
    expect(getOverdueDays(due, reference)).toBe(1);

    const laterReference = new Date('2026-07-04T00:00:00');
    expect(getOverdueDays(due, laterReference)).toBe(3);
  });
});

describe('buildOverdueSanctionNote', () => {
  it('returns fallback note (or null) when there is no overdue', () => {
    expect(buildOverdueSanctionNote(0, 'catatan lain')).toBe('catatan lain');
    expect(buildOverdueSanctionNote(0, null)).toBeNull();
  });

  it('builds an overdue note and appends fallback note when present', () => {
    expect(buildOverdueSanctionNote(3, null)).toBe('Terlambat 3 hari');
    expect(buildOverdueSanctionNote(3, 'rusak ringan')).toBe('Terlambat 3 hari. rusak ringan');
  });
});

describe('sanitizeString', () => {
  it('strips angle brackets and quote characters', () => {
    expect(sanitizeString('<script>alert("x")</script>')).toBe('scriptalert(x)/script');
  });
});

describe('paginate', () => {
  it('slices array according to page and limit', () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    expect(paginate(items, 1, 3)).toEqual([1, 2, 3]);
    expect(paginate(items, 2, 3)).toEqual([4, 5, 6]);
    expect(paginate(items, 3, 3)).toEqual([7]);
  });
});

describe('formatDateTimeForMySQL', () => {
  it('returns null for empty input', () => {
    expect(formatDateTimeForMySQL(undefined)).toBeNull();
    expect(formatDateTimeForMySQL(null)).toBeNull();
    expect(formatDateTimeForMySQL('')).toBeNull();
  });

  it('parses an ISO-like string into MySQL DATETIME format', () => {
    expect(formatDateTimeForMySQL('2026-07-18T09:30:00')).toBe('2026-07-18 09:30:00');
    expect(formatDateTimeForMySQL('2026-07-18 09:30')).toBe('2026-07-18 09:30:00');
  });

  it('formats a Date instance using its local components', () => {
    const date = new Date(2026, 6, 18, 9, 30, 5);
    expect(formatDateTimeForMySQL(date)).toBe('2026-07-18 09:30:05');
  });
});
