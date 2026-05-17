import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import jwt from 'jsonwebtoken';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import {
    AuthResponse,
    LoginCredentials,
    PasswordResetConfirmPayload,
    RegisterCredentials,
    User
} from '../types/auth';
import {
    deletePasswordResetSession,
    getPasswordResetSession,
    savePasswordResetSession
} from '../utils/password-reset-store';

interface UserRow extends RowDataPacket {
  id: number;
  nip: string;
  name: string;
  email: string;
  password: string;
  role: string;
  staff_access_type: string;
  gender: string | null;
  work_unit: string | null;
  home_address: string | null;
  photo_path: string | null;
  created_at: Date;
  last_login: Date;
  uml_access: boolean;
}

interface ProfileUpdatePayload {
  name?: string;
  email?: string;
  nip?: string;
  gender?: string;
  workUnit?: string;
  homeAddress?: string;
}

interface PasswordResetRequestResponse {
  success: boolean;
  message: string;
  data?: {
    deliveryTarget: string;
    expiresInMinutes: number;
    deliveryMethod: 'local';
    verificationCode: string;
  };
}

export class AuthService {
  private static readonly PASSWORD_RESET_EXPIRES_IN_MINUTES = 10;
  private static readonly PASSWORD_RESET_MAX_ATTEMPTS = 5;

  private mapRowToUser(row: UserRow): User {
    return {
      id: row.id,
      nip: row.nip,
      name: row.name,
      email: row.email,
      role: row.role,
      staffAccessType: row.staff_access_type,
      gender: row.gender ?? undefined,
      workUnit: row.work_unit ?? undefined,
      homeAddress: row.home_address ?? undefined,
      photoPath: row.photo_path ?? undefined,
      createdAt: row.created_at,
      lastLogin: row.last_login,
      umlAccess: row.uml_access
    };
  }

  /**
   * Authenticate user login
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { nip, password } = credentials;
    const identifier = nip.trim();

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, password, role, staff_access_type, gender, work_unit, home_address, photo_path, created_at, last_login, uml_access FROM users WHERE nip = ? OR email = ? LIMIT 1',
      [identifier, identifier]
    );

    if (rows.length === 0) {
      return {
        success: false,
        message: 'Akun tidak ditemukan'
      };
    }

    const user = rows[0];

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return {
        success: false,
        message: 'Password yang Anda masukkan salah'
      };
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = this.generateToken(user);
    const userData = this.mapRowToUser(user);

    return {
      success: true,
      message: 'Login berhasil',
      data: { user: userData, token }
    };
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const { nip, name, email, password } = credentials;
    const normalizedRole = 'user';

    const [existingRows] = await pool.query<UserRow[]>(
      'SELECT id FROM users WHERE nip = ? OR email = ?',
      [nip, email]
    );

    if (existingRows.length > 0) {
      return {
        success: false,
        message: 'Akun dengan NIP atau email ini sudah terdaftar'
      };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (nip, name, email, password, role, staff_access_type) VALUES (?, ?, ?, ?, ?, ?)',
      [nip, name, email, hashedPassword, normalizedRole, null]
    );

    const [newUserRows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, home_address, photo_path, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    const newUser = newUserRows[0];

    return {
      success: true,
      message: 'Pendaftaran berhasil',
      data: {
        user: this.mapRowToUser(newUser),
        token: ''
      }
    };
  }

  async requestPasswordResetCode(nip: string): Promise<PasswordResetRequestResponse> {
    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email FROM users WHERE nip = ?',
      [nip]
    );

    if (rows.length === 0) {
      return { success: false, message: 'NIP tidak ditemukan' };
    }

    const user = rows[0];
    const verificationCode = this.generateVerificationCode();
    const expiresAt = Date.now() + (AuthService.PASSWORD_RESET_EXPIRES_IN_MINUTES * 60 * 1000);
    const codeHash = await bcrypt.hash(verificationCode, 10);

    await savePasswordResetSession({
      userId: user.id,
      nip: user.nip,
      email: user.email,
      codeHash,
      expiresAt,
      attemptsLeft: AuthService.PASSWORD_RESET_MAX_ATTEMPTS
    });

    return {
      success: true,
      message: 'Kode verifikasi berhasil dibuat dan ditampilkan langsung di aplikasi ini.',
      data: {
        deliveryTarget: 'Aplikasi lokal',
        expiresInMinutes: AuthService.PASSWORD_RESET_EXPIRES_IN_MINUTES,
        deliveryMethod: 'local',
        verificationCode
      }
    };
  }

  async resetPasswordWithCode(payload: PasswordResetConfirmPayload): Promise<AuthResponse> {
    const { nip, verificationCode, newPassword } = payload;
    const [rows] = await pool.query<UserRow[]>(
      'SELECT id FROM users WHERE nip = ?',
      [nip]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Pengguna tidak ditemukan' };
    }

    const user = rows[0];
    const session = await getPasswordResetSession(nip);

    if (!session || session.userId !== user.id) {
      return {
        success: false,
        message: 'Kode verifikasi tidak ditemukan atau sudah kedaluwarsa. Silakan minta kode baru.'
      };
    }

    const isValidCode = await bcrypt.compare(verificationCode, session.codeHash);
    if (!isValidCode) {
      const nextAttemptsLeft = session.attemptsLeft - 1;
      if (nextAttemptsLeft <= 0) {
        await deletePasswordResetSession(nip);
        return {
          success: false,
          message: 'Kode verifikasi salah terlalu banyak kali. Silakan minta kode baru.'
        };
      }

      await savePasswordResetSession({
        ...session,
        attemptsLeft: nextAttemptsLeft
      });

      return {
        success: false,
        message: `Kode verifikasi salah. Sisa percobaan: ${nextAttemptsLeft}.`
      };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, user.id]);
    await deletePasswordResetSession(nip);

    return { success: true, message: 'Password berhasil diubah. Silakan login dengan password baru.' };
  }

  async getProfile(userId: number): Promise<AuthResponse> {
    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, home_address, photo_path, created_at, last_login, uml_access FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return { success: false, message: 'User not found' };
    }

    const user = rows[0];

    return {
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: this.mapRowToUser(user),
        token: ''
      }
    };
  }

  async updateProfile(userId: number, payload: ProfileUpdatePayload, photoPath?: string): Promise<AuthResponse> {
    const fields: string[] = [];
    const values: any[] = [];

    if (payload.name !== undefined) {
      fields.push('name = ?');
      values.push(payload.name);
    }

    if (payload.email !== undefined) {
      fields.push('email = ?');
      values.push(payload.email);
    }

    if (payload.nip !== undefined) {
      fields.push('nip = ?');
      values.push(payload.nip);
    }

    if (payload.gender !== undefined) {
      fields.push('gender = ?');
      values.push(payload.gender);
    }

    if (payload.workUnit !== undefined) {
      fields.push('work_unit = ?');
      values.push(payload.workUnit);
    }

    if (payload.homeAddress !== undefined) {
      fields.push('home_address = ?');
      values.push(payload.homeAddress);
    }

    if (photoPath) {
      fields.push('photo_path = ?');
      values.push(photoPath);
      console.log(`[Service] Setting photo path: ${photoPath}`);
    }

    if (fields.length === 0) {
      return { success: false, message: 'Tidak ada perubahan data' };
    }

    fields.push('updated_at = NOW()');
    values.push(userId);

    try {
      await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
      console.log(`[Service] Profile updated for user ${userId}`);
    } catch (error: any) {
      console.error(`[Service] Database error during profile update:`, error);
      if (error.code === 'ER_DUP_ENTRY') {
        return { success: false, message: 'NIP atau email sudah digunakan' };
      }
      return { success: false, message: 'Gagal memperbarui profil' };
    }

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, home_address, photo_path, created_at, last_login, uml_access FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Pengguna tidak ditemukan' };
    }

    const updatedUser = this.mapRowToUser(rows[0]);
    console.log(`[Service] Updated user photo_path:`, updatedUser.photoPath);

    return {
      success: true,
      message: 'Profil berhasil diperbarui',
      data: {
        user: updatedUser,
        token: ''
      }
    };
  }

  private generateToken(user: UserRow): string {
    const payload = {
      id: user.id,
      nip: user.nip,
      name: user.name,
      email: user.email,
      role: user.role,
      staffAccessType: user.staff_access_type,
      gender: user.gender,
      workUnit: user.work_unit,
      homeAddress: user.home_address,
      photoPath: user.photo_path
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    return jwt.sign(payload, secret, {
      expiresIn: '24h'
    });
  }

  verifyToken(token: string): any {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }
      return jwt.verify(token, secret);
    } catch {
      return null;
    }
  }

  private generateVerificationCode(): string {
    return randomInt(100000, 1000000).toString();
  }
}

export default new AuthService();
