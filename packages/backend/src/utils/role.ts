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

export const canManageOverdueEmergencyUsage = (
  actorRole: string | null | undefined,
  borrowerRole: string | null | undefined
): boolean => {
  if (hasAnyRole(actorRole, ['admin', 'leader'])) return true;
  if (!actorRole || !borrowerRole) return false;
  return normalizeRole(actorRole) === normalizeRole(borrowerRole);
};
