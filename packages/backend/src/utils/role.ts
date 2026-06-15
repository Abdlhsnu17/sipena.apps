export const normalizeRole = (role?: string | null): string => {
  if (!role) return '';
  const normalized = role.toLowerCase().trim().replace(/[\s-]+/g, '_');

  if (normalized === 'tekniksi') return 'teknisi';
  if (normalized === 'staffpj') return 'staff_pj';
  if (normalized === 'staffpelayanan' || normalized === 'staff_pelayanan') return 'staff';
  if (normalized === 'pengguna') return 'user';

  return normalized;
};

export const hasAnyRole = (role: string | null | undefined, allowedRoles: string[]): boolean => {
  const normalizedRole = normalizeRole(role);
  return allowedRoles.map((allowed) => normalizeRole(allowed)).includes(normalizedRole);
};

export const canManageMaintenanceCompletion = (role: string | null | undefined): boolean => {
  return hasAnyRole(role, ['admin', 'leader', 'teknisi']);
};

export const canManageInventory = (role: string | null | undefined): boolean => {
  return hasAnyRole(role, ['admin', 'leader', 'staff_pj']);
};

export const canManageBorrowing = (role: string | null | undefined): boolean => {
  return hasAnyRole(role, ['admin', 'leader', 'staff', 'staff_pj', 'staff pj', 'user']);
};

export const canCompleteUsage = (
  actorRole: string | null | undefined,
  actorId?: number | string | null,
  operatorUserId?: number | string | null,
  createdBy?: number | string | null
): boolean => {
  if (hasAnyRole(actorRole, ['admin', 'leader'])) return true;

  const normalizedActorId = Number(actorId);
  if (!Number.isFinite(normalizedActorId) || normalizedActorId <= 0) return false;

  return [operatorUserId, createdBy].some((value) => {
    const normalizedValue = Number(value);
    return Number.isFinite(normalizedValue) && normalizedValue > 0 && normalizedValue === normalizedActorId;
  });
};

export const canManageOverdueEmergencyUsage = (
  actorRole: string | null | undefined,
  borrowerRole: string | null | undefined
): boolean => {
  if (hasAnyRole(actorRole, ['admin', 'leader'])) return true;
  if (!actorRole || !borrowerRole) return false;
  return normalizeRole(actorRole) === normalizeRole(borrowerRole);
};
