import jwt from 'jsonwebtoken';

export const TEST_JWT_SECRET = 'sipena-test-jwt-secret-yang-cukup-panjang-32';

/**
 * Baris `users` seperti yang dikembalikan MySQL — snake_case, `must_change_password`
 * berupa 0/1, dan `session_version` numerik. Sengaja meniru bentuk baris asli agar
 * pemetaan di middleware dan service ikut teruji.
 */
export interface UserRowOverrides {
  id?: number;
  nip?: string;
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  staff_access_type?: string | null;
  work_unit?: string | null;
  session_version?: number;
  account_status?: 'active' | 'inactive' | 'suspended';
  must_change_password?: 0 | 1;
  failed_login_attempts?: number;
  locked_until?: Date | null;
}

export const createUserRow = (overrides: UserRowOverrides = {}) => ({
  id: 7,
  nip: '199203102019031005',
  name: 'Siti Rahmawati',
  email: 'siti@rs.example.id',
  password: '$2a$12$hashyanghanyadipakaitest0000000000000000000000000000',
  role: 'admin',
  staff_access_type: 'all',
  gender: 'Perempuan',
  work_unit: 'IPSRS',
  sub_work_unit: null,
  home_address: null,
  phone_number: '6281234567890',
  photo_path: null,
  created_at: new Date('2026-01-05T02:00:00.000Z'),
  updated_at: new Date('2026-06-01T02:00:00.000Z'),
  last_login: new Date('2026-08-01T02:00:00.000Z'),
  session_version: 3,
  account_status: 'active' as const,
  must_change_password: 0 as 0 | 1,
  uml_access: true,
  failed_login_attempts: 0,
  locked_until: null as Date | null,
  ...overrides,
});

export type UserRow = ReturnType<typeof createUserRow>;

/** Menerbitkan JWT yang cocok dengan baris pengguna, seperti dilakukan AuthService. */
export const signTokenFor = (
  row: Pick<UserRow, 'id' | 'nip' | 'name' | 'email' | 'role' | 'session_version'>,
  overrides: Record<string, unknown> = {},
): string =>
  jwt.sign(
    {
      id: row.id,
      nip: row.nip,
      name: row.name,
      email: row.email,
      role: row.role,
      sessionVersion: row.session_version,
      ...overrides,
    },
    TEST_JWT_SECRET,
    overrides.exp !== undefined ? {} : { expiresIn: '1h' },
  );

export const bearer = (token: string): string => `Bearer ${token}`;

/** SQL yang dijalankan `authMiddleware` untuk memuat pengguna dari token. */
export const AUTH_USER_LOOKUP = /FROM\s+users[\s\S]*WHERE id = \?[\s\S]*deleted_at IS NULL/;

/** SQL yang dijalankan `AuthService.login` untuk mencari akun. */
export const LOGIN_USER_LOOKUP = /FROM users WHERE nip = \? OR email = \?/;
