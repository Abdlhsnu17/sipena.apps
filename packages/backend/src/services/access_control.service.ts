import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ApiResponse } from '../models';
import { normalizeRole } from '../utils/role';

export type AccessMenu = {
  id: number;
  code: string;
  label: string;
  path: string;
  sort_order: number;
};

export type AccessRole = {
  id: number;
  code: string;
  name: string;
  description: string | null;
};

interface RoleRow extends RowDataPacket, AccessRole {}
interface MenuRow extends RowDataPacket, AccessMenu {}

const DEFAULT_ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Administrator dengan akses penuh sistem',
  leader: 'Pimpinan dengan akses pengawasan dan operasional',
  staff: 'Staff pelayanan untuk operasional harian',
  staff_pj: 'Staff penanggung jawab inventaris',
  teknisi: 'Teknisi untuk pemeliharaan sarana',
  user: 'Pengguna self-service',
};

const DEFAULT_MENUS = [
  { code: 'dashboard', label: 'Dashboard', path: '/', sortOrder: 10 },
  { code: 'uml', label: 'Dokumentasi Sistem', path: '/uml', sortOrder: 20 },
  { code: 'medical_assets', label: 'Inventaris Medis', path: '/medical-assets', sortOrder: 30 },
  { code: 'non_medical_assets', label: 'Inventaris Non-Medis', path: '/non-medical-assets', sortOrder: 40 },
  { code: 'maintenance', label: 'Pemeliharaan Sarana', path: '/maintenance', sortOrder: 50 },
  { code: 'dss', label: 'SPK Prioritas Aset', path: '/dss', sortOrder: 60 },
  { code: 'asset_usage', label: 'Penggunaan', path: '/asset-usage', sortOrder: 70 },
  { code: 'reports', label: 'Laporan & Analitik', path: '/reports', sortOrder: 80 },
  { code: 'uploads', label: 'Unggah Dokumen', path: '/unggahan', sortOrder: 90 },
  { code: 'activity_archive', label: 'Arsip Riwayat Aktivitas', path: '/activity-archive', sortOrder: 100 },
  { code: 'users', label: 'Manajemen Pengguna', path: '/users', sortOrder: 110 },
  { code: 'borrowing', label: 'Peminjaman', path: '/borrowing', sortOrder: 120 },
  { code: 'returns', label: 'Pengembalian', path: '/returns', sortOrder: 130 },
  { code: 'sanctions', label: 'Manajemen Sanksi', path: '/sanctions', sortOrder: 140 },
  { code: 'disposal', label: 'Penghapusan Aset', path: '/disposal', sortOrder: 150 },
  { code: 'settings', label: 'Pengaturan', path: '/settings', sortOrder: 160 },
] as const;

const DEFAULT_ROLE_MENU_CODES: Record<string, string[]> = {
  admin: DEFAULT_MENUS.map((menu) => menu.code),
  leader: DEFAULT_MENUS.map((menu) => menu.code),
  staff_pj: [
    'dashboard',
    'uml',
    'medical_assets',
    'non_medical_assets',
    'maintenance',
    'dss',
    'asset_usage',
    'reports',
    'uploads',
    'activity_archive',
    'borrowing',
    'returns',
    'settings',
  ],
  staff: [
    'dashboard',
    'uml',
    'medical_assets',
    'non_medical_assets',
    'maintenance',
    'dss',
    'asset_usage',
    'reports',
    'uploads',
    'activity_archive',
    'borrowing',
    'returns',
    'settings',
  ],
  teknisi: ['dashboard', 'uml', 'maintenance', 'dss', 'reports', 'uploads', 'activity_archive', 'settings'],
  user: [
    'dashboard',
    'uml',
    'medical_assets',
    'non_medical_assets',
    'dss',
    'asset_usage',
    'reports',
    'uploads',
    'activity_archive',
    'borrowing',
    'returns',
    'settings',
  ],
};

export class AccessControlService {
  async ensureDefaults(): Promise<void> {
    for (const [code, description] of Object.entries(DEFAULT_ROLE_DESCRIPTIONS)) {
      await pool.query(
        `INSERT INTO roles (code, name, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
        [code, this.getRoleName(code), description],
      );
    }

    for (const menu of DEFAULT_MENUS) {
      await pool.query(
        `INSERT INTO menus (code, label, path, sort_order)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE label = VALUES(label), path = VALUES(path), sort_order = VALUES(sort_order)`,
        [menu.code, menu.label, menu.path, menu.sortOrder],
      );
    }

    for (const [roleCode, menuCodes] of Object.entries(DEFAULT_ROLE_MENU_CODES)) {
      await pool.query(
        `INSERT IGNORE INTO role_menu_permissions (role_id, menu_id)
         SELECT r.id, m.id
         FROM roles r
         JOIN menus m ON m.code IN (?)
         WHERE r.code = ?`,
        [menuCodes, roleCode],
      );
    }
  }

  async getMatrix(): Promise<ApiResponse<{ roles: AccessRole[]; menus: AccessMenu[]; permissions: Record<string, string[]> }>> {
    await this.ensureDefaults();

    const [roles] = await pool.query<RoleRow[]>('SELECT id, code, name, description FROM roles ORDER BY id ASC');
    const [menus] = await pool.query<MenuRow[]>(
      'SELECT id, code, label, path, sort_order FROM menus ORDER BY sort_order ASC, label ASC',
    );
    const [permissionRows] = await pool.query<RowDataPacket[]>(
      `SELECT r.code AS role_code, m.code AS menu_code
       FROM role_menu_permissions rmp
       JOIN roles r ON r.id = rmp.role_id
       JOIN menus m ON m.id = rmp.menu_id
       ORDER BY r.id ASC, m.sort_order ASC`,
    );

    const permissions: Record<string, string[]> = {};
    roles.forEach((role) => {
      permissions[role.code] = [];
    });
    permissionRows.forEach((row) => {
      const roleCode = String(row.role_code);
      const menuCode = String(row.menu_code);
      permissions[roleCode] = [...(permissions[roleCode] || []), menuCode];
    });

    return {
      success: true,
      message: 'Access control matrix retrieved successfully',
      data: { roles, menus, permissions },
    };
  }

  async getRoleMenus(role: string): Promise<ApiResponse<AccessMenu[]>> {
    await this.ensureDefaults();

    const normalizedRole = normalizeRole(role);
    const [menus] = await pool.query<MenuRow[]>(
      `SELECT m.id, m.code, m.label, m.path, m.sort_order
       FROM roles r
       JOIN role_menu_permissions rmp ON rmp.role_id = r.id
       JOIN menus m ON m.id = rmp.menu_id
       WHERE r.code = ?
       ORDER BY m.sort_order ASC, m.label ASC`,
      [normalizedRole],
    );

    return {
      success: true,
      message: 'Role menus retrieved successfully',
      data: menus,
    };
  }

  async updateRoleMenus(roleCode: string, menuCodes: string[]): Promise<ApiResponse<{ role: string; menuCodes: string[] }>> {
    await this.ensureDefaults();

    const normalizedRole = normalizeRole(roleCode);
    const [roleRows] = await pool.query<RoleRow[]>('SELECT id, code FROM roles WHERE code = ? LIMIT 1', [normalizedRole]);
    if (roleRows.length === 0) {
      return { success: false, message: 'Role tidak ditemukan' };
    }

    const sanitizedMenuCodes = Array.from(new Set(menuCodes.map((code) => String(code).trim()).filter(Boolean)));
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM role_menu_permissions WHERE role_id = ?', [roleRows[0].id]);

      if (sanitizedMenuCodes.length > 0) {
        const [result] = await connection.query<ResultSetHeader>(
          `INSERT IGNORE INTO role_menu_permissions (role_id, menu_id)
           SELECT ?, id
           FROM menus
           WHERE code IN (?)`,
          [roleRows[0].id, sanitizedMenuCodes],
        );

        if (result.affectedRows === 0 && sanitizedMenuCodes.length > 0) {
          await connection.rollback();
          return { success: false, message: 'Menu yang dipilih tidak valid' };
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return {
      success: true,
      message: 'Hak akses role berhasil diperbarui',
      data: { role: normalizedRole, menuCodes: sanitizedMenuCodes },
    };
  }

  private getRoleName(code: string): string {
    switch (normalizeRole(code)) {
      case 'admin':
        return 'Admin';
      case 'leader':
        return 'Leader';
      case 'staff_pj':
        return 'Staff PJ';
      case 'teknisi':
        return 'Teknisi';
      case 'user':
        return 'Pengguna';
      default:
        return 'Staff Pelayanan';
    }
  }
}

export default new AccessControlService();
