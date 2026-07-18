import { describe, expect, it } from 'vitest';
import { AssetUsageService, generateUsageNumber, mapUsageRow, toLocalIsoDateTime } from './asset_usage.service';

// resolveUsageThresholdState is private; accessed via `as any` to unit-test the
// warning (>10) / mandatory-check (>=25) usage-frequency rule described in the PRD.
type AssetUsageServiceInternals = {
  resolveUsageThresholdState: (totalUsage: number) => 'normal' | 'warning' | 'mandatory_check';
};

const asInternals = (service: AssetUsageService): AssetUsageServiceInternals =>
  service as unknown as AssetUsageServiceInternals;

describe('AssetUsageService usage threshold rule', () => {
  const service = asInternals(new AssetUsageService());

  it('is normal at or below 10 uses', () => {
    expect(service.resolveUsageThresholdState(0)).toBe('normal');
    expect(service.resolveUsageThresholdState(10)).toBe('normal');
  });

  it('is warning above 10 uses and below 25', () => {
    expect(service.resolveUsageThresholdState(11)).toBe('warning');
    expect(service.resolveUsageThresholdState(24)).toBe('warning');
  });

  it('is mandatory_check at or above 25 uses', () => {
    expect(service.resolveUsageThresholdState(25)).toBe('mandatory_check');
    expect(service.resolveUsageThresholdState(30)).toBe('mandatory_check');
  });
});

describe('toLocalIsoDateTime', () => {
  it('returns an empty string for missing/invalid values', () => {
    expect(toLocalIsoDateTime(null)).toBe('');
    expect(toLocalIsoDateTime('garbage')).toBe('');
  });

  it('formats a Date using local components', () => {
    const date = new Date(2026, 6, 18, 9, 30, 0);
    expect(toLocalIsoDateTime(date)).toBe('2026-07-18T09:30:00');
  });
});

describe('generateUsageNumber', () => {
  it('produces a PG-prefixed number derived from the given date', () => {
    const usageNumber = generateUsageNumber(new Date(2026, 6, 18, 9, 30, 0));
    expect(usageNumber).toMatch(/^PG-20260718-093000-\d{4}$/);
  });
});

describe('mapUsageRow', () => {
  it('marks records linked to a borrowing as borrowing_sync regardless of stored source_type', () => {
    const mapped = mapUsageRow({
      borrowing_id: 42,
      source_type: 'manual',
    } as any);

    expect(mapped.borrowingId).toBe(42);
    expect(mapped.sourceType).toBe('borrowing_sync');
  });

  it('defaults standalone records to manual when no source_type is stored', () => {
    const mapped = mapUsageRow({
      borrowing_id: null,
    } as any);

    expect(mapped.sourceType).toBe('manual');
  });

  it('preserves an explicit source_type for standalone records', () => {
    const mapped = mapUsageRow({
      borrowing_id: null,
      source_type: 'manual',
    } as any);

    expect(mapped.sourceType).toBe('manual');
  });
});
