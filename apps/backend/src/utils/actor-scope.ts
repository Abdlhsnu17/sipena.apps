import { hasAnyRole } from './role';

export type ActorScopeMode = 'full_access' | 'work_unit' | 'own_records';

export interface ActorScopeInput {
  actorUserId?: number | string | null;
  actorRole?: string | null;
  actorWorkUnit?: string | null;
  /** Role yang boleh melihat seluruh data. Berbeda per modul. */
  fullAccessRoles: string[];
}

export interface ActorScope {
  mode: ActorScopeMode;
  /** Terisi hanya pada mode 'own_records'. */
  actorUserId: number | null;
  /** Terisi hanya pada mode 'work_unit', sudah dinormalkan lowercase+trim. */
  workUnit: string | null;
}

// Sama dengan normalizeComparableText di borrowing/maintenance service; disalin di
// sini agar util ini tidak perlu mengimpor service (menghindari siklus impor).
const normalizeComparableText = (value?: string | null): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';

/**
 * Menentukan cakupan data yang boleh dilihat seorang aktor.
 *
 * Aturannya sama untuk peminjaman dan pemeliharaan, hanya daftar role
 * berakses-penuh yang berbeda, sehingga sebelumnya logika ini disalin di dua
 * service. Dengan satu sumber kebenaran, agregat dashboard dijamin memakai
 * cakupan yang persis sama dengan daftar datanya.
 */
export const resolveActorScope = ({
  actorUserId,
  actorRole,
  actorWorkUnit,
  fullAccessRoles,
}: ActorScopeInput): ActorScope => {
  const parsedActorId = Number(actorUserId);
  const hasValidActorId = Number.isFinite(parsedActorId) && parsedActorId > 0;
  const isFullAccess = hasAnyRole(actorRole, fullAccessRoles);
  const isStaffPj = hasAnyRole(actorRole, ['staff_pj', 'staff pj']);
  const workUnit = normalizeComparableText(actorWorkUnit);

  if (isStaffPj && hasValidActorId && workUnit) {
    return { mode: 'work_unit', actorUserId: null, workUnit };
  }

  if (hasValidActorId && !isFullAccess) {
    return { mode: 'own_records', actorUserId: parsedActorId, workUnit: null };
  }

  return { mode: 'full_access', actorUserId: null, workUnit: null };
};
