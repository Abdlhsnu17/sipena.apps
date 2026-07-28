<?php

namespace App\Support;

class RoleHelper
{
    public static function normalize(?string $role): string
    {
        if (!$role) {
            return '';
        }

        $normalized = strtolower(trim(preg_replace('/[\s-]+/', '_', $role)));

        return match ($normalized) {
            'tekniksi' => 'teknisi',
            'staffpj' => 'staff_pj',
            'staffpelayanan', 'staff_pelayanan' => 'staff',
            'pengguna' => 'user',
            default => $normalized,
        };
    }

    public static function hasAnyRole(?string $role, array $allowedRoles): bool
    {
        $normalizedRole = self::normalize($role);

        return in_array($normalizedRole, array_map(fn ($r) => self::normalize($r), $allowedRoles), true);
    }

    public static function canManageMaintenanceCompletion(?string $role): bool
    {
        return self::hasAnyRole($role, ['admin', 'leader', 'teknisi']);
    }

    public static function canManageInventory(?string $role): bool
    {
        return self::hasAnyRole($role, ['admin', 'leader', 'staff_pj']);
    }

    public static function canManageBorrowing(?string $role): bool
    {
        return self::hasAnyRole($role, ['admin', 'leader', 'staff', 'staff_pj', 'user']);
    }

    public static function canCompleteUsage(?string $actorRole, $actorId, $operatorUserId, $createdBy): bool
    {
        if (self::hasAnyRole($actorRole, ['admin', 'leader'])) {
            return true;
        }

        $actorId = (int) $actorId;
        if ($actorId <= 0) {
            return false;
        }

        return (int) $operatorUserId === $actorId || (int) $createdBy === $actorId;
    }

    public static function canViewOtherUsersActivity(?string $role): bool
    {
        return self::hasAnyRole($role, ['admin', 'leader', 'staff', 'staff_pj']);
    }

    public static function canManageOverdueEmergencyUsage(?string $actorRole, ?string $borrowerRole): bool
    {
        if (self::hasAnyRole($actorRole, ['admin', 'leader'])) {
            return true;
        }

        if (!$actorRole || !$borrowerRole) {
            return false;
        }

        return self::normalize($actorRole) === self::normalize($borrowerRole);
    }
}
