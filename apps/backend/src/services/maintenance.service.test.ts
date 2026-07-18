import { describe, expect, it } from 'vitest';
import {
  MaintenanceService,
  formatMaintenanceStatusLabel,
  normalizeComparableText,
  shouldSendMaintenancePhoneNotification,
  toLocalIsoDateTime,
} from './maintenance.service';

// Private methods are accessed via `as any` to unit-test the SLA/due-date
// calculation rules without exposing them as part of the public API.
type MaintenanceServiceInternals = {
  buildSlaInsight: (row: Record<string, any>) => {
    slaStatus: string;
    slaRemainingMinutes?: number;
    slaLateMinutes?: number;
  };
  buildAutomaticDueAt: (scheduledDate: string, priority?: string | null) => string | null;
};

const asInternals = (service: MaintenanceService): MaintenanceServiceInternals =>
  service as unknown as MaintenanceServiceInternals;

describe('normalizeComparableText', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeComparableText('  Ruang    Operasi  ')).toBe('ruang operasi');
    expect(normalizeComparableText(null)).toBe('');
  });
});

describe('toLocalIsoDateTime', () => {
  it('returns an empty string for missing/invalid values', () => {
    expect(toLocalIsoDateTime(null)).toBe('');
    expect(toLocalIsoDateTime('not-a-date')).toBe('');
  });

  it('formats a Date using local components as an ISO-like string', () => {
    const date = new Date(2026, 6, 18, 9, 30, 0);
    expect(toLocalIsoDateTime(date)).toBe('2026-07-18T09:30:00');
  });
});

describe('formatMaintenanceStatusLabel', () => {
  it('maps known statuses to their Indonesian label', () => {
    expect(formatMaintenanceStatusLabel('requested')).toBe('diajukan');
    expect(formatMaintenanceStatusLabel('scheduled')).toBe('disetujui');
    expect(formatMaintenanceStatusLabel('in_progress')).toBe('diproses');
    expect(formatMaintenanceStatusLabel('completed')).toBe('laporan pelaksanaan selesai dan menunggu verifikasi');
    expect(formatMaintenanceStatusLabel('validated')).toBe('divalidasi');
    expect(formatMaintenanceStatusLabel('cancelled')).toBe('dibatalkan');
  });

  it('falls back to the raw status (or a default) when unknown', () => {
    expect(formatMaintenanceStatusLabel('weird_status')).toBe('weird_status');
    expect(formatMaintenanceStatusLabel(null)).toBe('diproses');
  });
});

describe('shouldSendMaintenancePhoneNotification', () => {
  it('sends for meaningful lifecycle transitions but not for the initial request', () => {
    expect(shouldSendMaintenancePhoneNotification('scheduled')).toBe(true);
    expect(shouldSendMaintenancePhoneNotification('in_progress')).toBe(true);
    expect(shouldSendMaintenancePhoneNotification('completed')).toBe(true);
    expect(shouldSendMaintenancePhoneNotification('validated')).toBe(true);
    expect(shouldSendMaintenancePhoneNotification('cancelled')).toBe(true);
    expect(shouldSendMaintenancePhoneNotification('requested')).toBe(false);
    expect(shouldSendMaintenancePhoneNotification(null)).toBe(false);
  });
});

describe('MaintenanceService SLA rules', () => {
  const service = asInternals(new MaintenanceService());

  it('reports no_target when there is no due date or the ticket is cancelled', () => {
    expect(service.buildSlaInsight({}).slaStatus).toBe('no_target');
    expect(
      service.buildSlaInsight({ due_at: '2026-07-01 00:00:00', status: 'cancelled' }).slaStatus,
    ).toBe('no_target');
  });

  it('reports met/met_late based on whether completion happened before or after the due date', () => {
    const onTime = service.buildSlaInsight({
      due_at: '2026-07-10 12:00:00',
      completed_date: '2026-07-10 10:00:00',
      status: 'validated',
    });
    expect(onTime.slaStatus).toBe('met');

    const late = service.buildSlaInsight({
      due_at: '2026-07-10 12:00:00',
      completed_date: '2026-07-10 14:00:00',
      status: 'validated',
    });
    expect(late.slaStatus).toBe('met_late');
    expect(late.slaLateMinutes).toBe(120);
  });

  it('reports overdue when the due date has already passed with no completion', () => {
    const due = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const result = service.buildSlaInsight({ due_at: due, status: 'in_progress' });
    expect(result.slaStatus).toBe('overdue');
  });

  it('reports at_risk within the 120-minute window, and on_track otherwise', () => {
    const soonDue = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    expect(service.buildSlaInsight({ due_at: soonDue, status: 'scheduled' }).slaStatus).toBe('at_risk');

    const farDue = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours from now
    expect(service.buildSlaInsight({ due_at: farDue, status: 'scheduled' }).slaStatus).toBe('on_track');
  });

  it('derives the automatic due date from scheduled date + priority lead time', () => {
    const dueAt = service.buildAutomaticDueAt('2026-07-18 09:00:00', 'critical');
    expect(dueAt).toBe('2026-07-18 17:00:00'); // critical = 8 hours lead time

    const normalDueAt = service.buildAutomaticDueAt('2026-07-18 09:00:00');
    expect(normalDueAt).toBe('2026-07-20 09:00:00'); // default priority = normal = 48 hours
  });
});
