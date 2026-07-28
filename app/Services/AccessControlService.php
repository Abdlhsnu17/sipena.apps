<?php

namespace App\Services;

use App\Models\Menu;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AccessControlService
{
    private const ROLE_DESCRIPTIONS = [
        'admin' => 'Administrator dengan akses penuh sistem',
        'leader' => 'Pimpinan dengan akses pengawasan dan operasional',
        'staff' => 'Staff pelayanan untuk operasional harian',
        'staff_pj' => 'Staff penanggung jawab inventaris',
        'teknisi' => 'Teknisi untuk pemeliharaan sarana',
        'user' => 'Pengguna self-service',
    ];

    private const ROLE_NAMES = [
        'admin' => 'Admin',
        'leader' => 'Leader',
        'staff_pj' => 'Staff PJ',
        'teknisi' => 'Teknisi',
        'user' => 'Pengguna',
    ];

    private const DEFAULT_MENUS = [
        ['code' => 'activity_archive', 'label' => 'Arsip & Riwayat', 'path' => '/activity-archive', 'sort_order' => 10],
        ['code' => 'dashboard', 'label' => 'Dashboard', 'path' => '/', 'sort_order' => 20],
        ['code' => 'uml', 'label' => 'Dokumentasi Sistem', 'path' => '/uml', 'sort_order' => 30],
        ['code' => 'medical_assets', 'label' => 'Inventaris Medis', 'path' => '/medical-assets', 'sort_order' => 40],
        ['code' => 'non_medical_assets', 'label' => 'Inventaris Non-Medis', 'path' => '/non-medical-assets', 'sort_order' => 50],
        ['code' => 'reports', 'label' => 'Laporan & Analitik', 'path' => '/reports', 'sort_order' => 60],
        ['code' => 'users', 'label' => 'Manajemen Pengguna', 'path' => '/users', 'sort_order' => 70],
        ['code' => 'sanctions', 'label' => 'Manajemen Sanksi', 'path' => '/sanctions', 'sort_order' => 80],
        ['code' => 'borrowing', 'label' => 'Peminjaman', 'path' => '/borrowing', 'sort_order' => 90],
        ['code' => 'maintenance', 'label' => 'Pemeliharaan Sarana', 'path' => '/maintenance', 'sort_order' => 100],
        ['code' => 'returns', 'label' => 'Pengembalian', 'path' => '/returns', 'sort_order' => 110],
        ['code' => 'settings', 'label' => 'Pengaturan', 'path' => '/settings', 'sort_order' => 120],
        ['code' => 'asset_usage', 'label' => 'Penggunaan', 'path' => '/asset-usage', 'sort_order' => 130],
        ['code' => 'disposal', 'label' => 'Penghapusan Aset', 'path' => '/disposal', 'sort_order' => 140],
        ['code' => 'dss', 'label' => 'SPK Prioritas Aset', 'path' => '/dss', 'sort_order' => 150],
        ['code' => 'uploads', 'label' => 'Unggah Dokumen', 'path' => '/unggahan', 'sort_order' => 160],
    ];

    private const DEFAULT_ROLE_MENU_CODES = [
        'admin' => null, // all
        'leader' => null, // all
        'staff_pj' => [
            'dashboard', 'uml', 'medical_assets', 'non_medical_assets', 'maintenance', 'dss',
            'asset_usage', 'reports', 'uploads', 'activity_archive', 'borrowing', 'returns', 'settings',
        ],
        'staff' => [
            'dashboard', 'uml', 'medical_assets', 'non_medical_assets', 'maintenance', 'dss',
            'asset_usage', 'reports', 'uploads', 'activity_archive', 'borrowing', 'returns', 'settings',
        ],
        'teknisi' => ['dashboard', 'uml', 'maintenance', 'dss', 'reports', 'uploads', 'activity_archive', 'settings'],
        'user' => [
            'dashboard', 'uml', 'medical_assets', 'non_medical_assets', 'dss', 'asset_usage',
            'reports', 'uploads', 'activity_archive', 'borrowing', 'returns', 'settings',
        ],
    ];

    public function ensureDefaults(): void
    {
        $allCodes = array_column(self::DEFAULT_MENUS, 'code');

        foreach (self::ROLE_DESCRIPTIONS as $code => $description) {
            Role::updateOrCreate(
                ['code' => $code],
                ['name' => self::ROLE_NAMES[$code] ?? 'Staff Pelayanan', 'description' => $description]
            );
        }

        foreach (self::DEFAULT_MENUS as $menu) {
            Menu::updateOrCreate(
                ['code' => $menu['code']],
                ['label' => $menu['label'], 'path' => $menu['path'], 'sort_order' => $menu['sort_order']]
            );
        }

        foreach (self::DEFAULT_ROLE_MENU_CODES as $roleCode => $menuCodes) {
            $role = Role::where('code', $roleCode)->first();
            if (!$role || $role->menus()->exists()) {
                continue;
            }

            $codes = $menuCodes ?? $allCodes;
            $menuIds = Menu::whereIn('code', $codes)->pluck('id');
            $role->menus()->syncWithoutDetaching($menuIds);
        }
    }

    public function visibleMenusFor(User $user): array
    {
        $this->ensureDefaults();

        $role = Role::where('code', $user->role)->first();

        if ($user->isAdmin() || !$role) {
            return Menu::orderBy('label')->orderBy('code')->get(['code', 'label', 'path'])->toArray();
        }

        return $role->menus()->orderBy('label')->orderBy('code')->get(['code', 'label', 'path'])->toArray();
    }

    public function getMatrix(): array
    {
        $this->ensureDefaults();

        $roles = Role::orderBy('id')->get(['id', 'code', 'name', 'description']);
        $menus = Menu::orderBy('label')->orderBy('code')->get(['id', 'code', 'label', 'path', 'sort_order']);

        $permissions = [];
        foreach ($roles as $role) {
            $permissions[$role->code] = $role->menus()->orderBy('label')->pluck('code')->toArray();
        }

        return ['roles' => $roles, 'menus' => $menus, 'permissions' => $permissions];
    }

    public function updateRoleMenus(string $roleCode, array $menuCodes): void
    {
        $this->ensureDefaults();

        $role = Role::where('code', $roleCode)->firstOrFail();
        $menuIds = Menu::whereIn('code', array_values(array_unique($menuCodes)))->pluck('id');

        DB::transaction(function () use ($role, $menuIds) {
            $role->menus()->sync($menuIds);
        });
    }
}
