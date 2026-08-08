import { describe, expect, it } from 'vitest';
import { resolveActorScope } from './actor-scope';

const BORROWING_ROLES = ['admin', 'leader'];
const MAINTENANCE_ROLES = ['admin', 'leader', 'teknisi'];

describe('resolveActorScope', () => {
  it('memberi akses penuh untuk admin dan leader', () => {
    for (const role of ['admin', 'leader']) {
      const scope = resolveActorScope({
        actorUserId: 5,
        actorRole: role,
        fullAccessRoles: BORROWING_ROLES,
      });

      expect(scope.mode).toBe('full_access');
      expect(scope.actorUserId).toBeNull();
      expect(scope.workUnit).toBeNull();
    }
  });

  it('membatasi staff biasa pada datanya sendiri', () => {
    const scope = resolveActorScope({
      actorUserId: 9,
      actorRole: 'staff',
      fullAccessRoles: BORROWING_ROLES,
    });

    expect(scope.mode).toBe('own_records');
    expect(scope.actorUserId).toBe(9);
  });

  it('membatasi staff_pj pada unit kerjanya, bukan pada dirinya sendiri', () => {
    const scope = resolveActorScope({
      actorUserId: 9,
      actorRole: 'staff_pj',
      actorWorkUnit: '  Instalasi   Radiologi ',
      fullAccessRoles: BORROWING_ROLES,
    });

    expect(scope.mode).toBe('work_unit');
    // Dinormalkan agar cocok dengan LOWER(TRIM(...)) di query.
    expect(scope.workUnit).toBe('instalasi radiologi');
    expect(scope.actorUserId).toBeNull();
  });

  it('menerima varian penulisan role "staff pj" dengan spasi', () => {
    const scope = resolveActorScope({
      actorUserId: 9,
      actorRole: 'staff pj',
      actorWorkUnit: 'IGD',
      fullAccessRoles: BORROWING_ROLES,
    });

    expect(scope.mode).toBe('work_unit');
    expect(scope.workUnit).toBe('igd');
  });

  it('menurunkan staff_pj tanpa unit kerja menjadi data sendiri, bukan akses penuh', () => {
    // Ini pembatas keamanan yang penting: unit kerja kosong tidak boleh
    // diartikan sebagai "boleh melihat semua".
    for (const workUnit of [undefined, null, '', '   ']) {
      const scope = resolveActorScope({
        actorUserId: 9,
        actorRole: 'staff_pj',
        actorWorkUnit: workUnit,
        fullAccessRoles: BORROWING_ROLES,
      });

      expect(scope.mode).toBe('own_records');
      expect(scope.actorUserId).toBe(9);
    }
  });

  it('memperlakukan teknisi berbeda antara modul peminjaman dan pemeliharaan', () => {
    const onBorrowing = resolveActorScope({
      actorUserId: 4,
      actorRole: 'teknisi',
      fullAccessRoles: BORROWING_ROLES,
    });
    const onMaintenance = resolveActorScope({
      actorUserId: 4,
      actorRole: 'teknisi',
      fullAccessRoles: MAINTENANCE_ROLES,
    });

    expect(onBorrowing.mode).toBe('own_records');
    expect(onMaintenance.mode).toBe('full_access');
  });

  it('menganggap aktor tanpa id sebagai akses penuh (dipakai pemanggilan internal)', () => {
    for (const id of [undefined, null, 0, -1, 'bukan-angka']) {
      const scope = resolveActorScope({
        actorUserId: id,
        actorRole: 'staff',
        fullAccessRoles: BORROWING_ROLES,
      });

      expect(scope.mode).toBe('full_access');
    }
  });

  it('menerima id aktor berupa string angka', () => {
    const scope = resolveActorScope({
      actorUserId: '12',
      actorRole: 'staff',
      fullAccessRoles: BORROWING_ROLES,
    });

    expect(scope.mode).toBe('own_records');
    expect(scope.actorUserId).toBe(12);
  });

  it('tidak terpengaruh perbedaan huruf besar/kecil pada role', () => {
    const scope = resolveActorScope({
      actorUserId: 3,
      actorRole: 'ADMIN',
      fullAccessRoles: BORROWING_ROLES,
    });

    expect(scope.mode).toBe('full_access');
  });
});
