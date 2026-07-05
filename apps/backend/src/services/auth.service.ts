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
    isValidPhoneNumber,
    normalizePhoneNumberForStorage,
    sendPasswordResetOtp,
} from '../utils/otp-delivery';
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
  sub_work_unit: string | null;
  home_address: string | null;
  phone_number: string | null;
  photo_path: string | null;
  created_at: Date;
  updated_at: Date;
  last_login: Date;
  session_version: number;
  account_status: 'active' | 'inactive' | 'suspended' | null;
  must_change_password: number | boolean;
  uml_access: boolean;
  failed_login_attempts: number;
  locked_until: Date | null;
}

interface ProfileUpdatePayload {
  name?: string;
  email?: string;
  nip?: string;
  gender?: string;
  workUnit?: string;
  subWorkUnit?: string;
  homeAddress?: string;
  phoneNumber?: string;
}

interface PasswordResetRequestResponse {
  success: boolean;
  message: string;
  data?: {
    deliveryTarget: string;
    expiresInMinutes: number;
    deliveryMethod: 'whatsapp' | 'sms' | 'local_preview';
    previewCode?: string;
  };
}

export class AuthService {
  private static readonly PASSWORD_RESET_EXPIRES_IN_MINUTES = 10;
  private static readonly PASSWORD_RESET_MAX_ATTEMPTS = 5;
  private static readonly MAX_FAILED_LOGIN_ATTEMPTS = 5;
  private static readonly ACCOUNT_LOCK_DURATION_MINUTES = 15;
  private static readonly PASSWORD_RESET_REQUEST_MESSAGE =
    'Jika data Anda terdaftar, kode verifikasi akan dikirim melalui kanal yang tersedia.';

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
      subWorkUnit: row.sub_work_unit ?? undefined,
      homeAddress: row.home_address ?? undefined,
      phoneNumber: row.phone_number ?? undefined,
      photoPath: row.photo_path ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login,
      sessionVersion: Number(row.session_version) || 0,
      accountStatus: row.account_status || 'active',
      mustChangePassword: Boolean(row.must_change_password),
      umlAccess: row.uml_access
    };
  }

  private maskEmail(email: string): string {
    const [localPart, domain = ''] = email.split('@');
    if (!localPart || !domain) {
      return 'email terdaftar';
    }

    const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
    const maskedLocalPart = `${visiblePrefix}${'*'.repeat(Math.max(localPart.length - visiblePrefix.length, 2))}`;
    return `${maskedLocalPart}@${domain}`;
  }

  /**
   * Authenticate user login
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { nip, password } = credentials;
    const identifier = nip.trim();

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, password, role, staff_access_type, gender, work_unit, sub_work_unit, home_address, phone_number, photo_path, created_at, updated_at, last_login, session_version, account_status, must_change_password, uml_access, failed_login_attempts, locked_until FROM users WHERE nip = ? OR email = ? LIMIT 1',
      [identifier, identifier]
    );

    if (rows.length === 0) {
      return {
        success: false,
        message: 'Akun tidak ditemukan'
      };
    }

    const user = rows[0];

    if ((user.account_status || 'active') !== 'active') {
      return {
        success: false,
        message: user.account_status === 'suspended'
          ? 'Akun Anda sedang ditangguhkan. Hubungi admin.'
          : 'Akun Anda sedang nonaktif. Hubungi admin.'
      };
    }

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      return {
        success: false,
        message: `Akun terkunci sementara karena terlalu banyak percobaan login gagal. Coba lagi dalam ${remainingMinutes} menit.`
      };
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      const nextFailedAttempts = (Number(user.failed_login_attempts) || 0) + 1;
      const shouldLock = nextFailedAttempts >= AuthService.MAX_FAILED_LOGIN_ATTEMPTS;

      await pool.query(
        `UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?`,
        [
          shouldLock ? 0 : nextFailedAttempts,
          shouldLock ? new Date(Date.now() + AuthService.ACCOUNT_LOCK_DURATION_MINUTES * 60 * 1000) : null,
          user.id
        ]
      );

      return {
        success: false,
        message: shouldLock
          ? `Akun terkunci sementara karena terlalu banyak percobaan login gagal. Coba lagi dalam ${AuthService.ACCOUNT_LOCK_DURATION_MINUTES} menit.`
          : 'Password yang Anda masukkan salah'
      };
    }

    await pool.query(
      'UPDATE users SET last_login = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [user.id]
    );

    const token = this.generateToken(user);
    const userData = this.mapRowToUser(user);

    return {
      success: true,
      message: 'Login berhasil',
      data: { user: userData, token }
    };
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const { nip, name, email, password, phoneNumber } = credentials;
    const normalizedRole = 'user';
    const normalizedPhoneNumber = normalizePhoneNumberForStorage(phoneNumber || '');

    if (!isValidPhoneNumber(normalizedPhoneNumber)) {
      return {
        success: false,
        message: 'Nomor WhatsApp/SMS tidak valid'
      };
    }

    const [existingRows] = await pool.query<UserRow[]>(
      'SELECT id FROM users WHERE nip = ? OR email = ? OR phone_number = ?',
      [nip, email, normalizedPhoneNumber]
    );

    if (existingRows.length > 0) {
      return {
        success: false,
        message: 'Akun dengan NIP atau email ini sudah terdaftar'
      };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (nip, name, email, password, role, staff_access_type, phone_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nip, name, email, hashedPassword, normalizedRole, null, normalizedPhoneNumber]
    );

    const [newUserRows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, sub_work_unit, home_address, phone_number, photo_path, created_at, updated_at, last_login, session_version, account_status, must_change_password, uml_access FROM users WHERE id = ?',
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
      'SELECT id, nip, name, email, phone_number FROM users WHERE nip = ?',
      [nip]
    );

    if (rows.length === 0) {
      return { success: true, message: AuthService.PASSWORD_RESET_REQUEST_MESSAGE };
    }

    const user = rows[0];
    if (!user.phone_number || !isValidPhoneNumber(user.phone_number)) {
      console.warn(`[RESET_PASSWORD] User ${user.id} has no valid phone number; skipping OTP delivery.`);
      return { success: true, message: AuthService.PASSWORD_RESET_REQUEST_MESSAGE };
    }
    const verificationCode = this.generateVerificationCode();
    const expiresAt = Date.now() + (AuthService.PASSWORD_RESET_EXPIRES_IN_MINUTES * 60 * 1000);
    const codeHash = await bcrypt.hash(verificationCode, 10);

    try {
      await savePasswordResetSession({
        userId: user.id,
        nip: user.nip,
        email: user.email,
        codeHash,
        expiresAt,
        attemptsLeft: AuthService.PASSWORD_RESET_MAX_ATTEMPTS
      });
    } catch (error) {
      console.error('Save password reset session error:', error);
      return {
        success: false,
        message: error instanceof Error
          ? error.message
          : 'Sesi reset password gagal disiapkan. Coba lagi beberapa saat.'
      };
    }

    let deliveryResult;
    try {
      deliveryResult = await sendPasswordResetOtp({
        phoneNumber: user.phone_number,
        userName: user.name,
        code: verificationCode,
        expiresInMinutes: AuthService.PASSWORD_RESET_EXPIRES_IN_MINUTES,
      });
    } catch (error) {
      console.error('Send password reset OTP error:', error);
      await deletePasswordResetSession(user.nip).catch(() => undefined);
      return {
        success: false,
        message: error instanceof Error
          ? error.message
          : 'Pengiriman kode verifikasi gagal. Coba lagi beberapa saat.'
      };
    }

    return {
      success: true,
      message: deliveryResult.preview
        ? 'Kode verifikasi tersedia di preview lokal pengembangan.'
        : AuthService.PASSWORD_RESET_REQUEST_MESSAGE,
      data: deliveryResult.preview
        ? {
            deliveryTarget: 'Preview lokal aplikasi',
            expiresInMinutes: AuthService.PASSWORD_RESET_EXPIRES_IN_MINUTES,
            deliveryMethod: 'local_preview',
            previewCode: verificationCode,
          }
        : undefined
    };
  }

  async resetPasswordWithCode(payload: PasswordResetConfirmPayload): Promise<AuthResponse> {
    const { nip, verificationCode, newPassword } = payload;
    const [rows] = await pool.query<UserRow[]>(
      'SELECT id FROM users WHERE nip = ?',
      [nip]
    );

    if (rows.length === 0) {
      return {
        success: false,
        message: 'Kode verifikasi tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.'
      };
    }

    const user = rows[0];
    const session = await getPasswordResetSession(nip);

    if (!session || session.userId !== user.id) {
      return {
        success: false,
        message: 'Kode verifikasi tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.'
      };
    }

    const isValidCode = await bcrypt.compare(verificationCode, session.codeHash);
    if (!isValidCode) {
      const nextAttemptsLeft = session.attemptsLeft - 1;
      if (nextAttemptsLeft <= 0) {
        await deletePasswordResetSession(nip);
        return {
          success: false,
          message: 'Kode verifikasi tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.'
        };
      }

      await savePasswordResetSession({
        ...session,
        attemptsLeft: nextAttemptsLeft
      });

      return {
        success: false,
        message: 'Kode verifikasi tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.'
      };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password = ?, must_change_password = 0, session_version = session_version + 1, updated_at = NOW() WHERE id = ?',
      [hashedPassword, user.id],
    );
    await deletePasswordResetSession(nip);

    return { success: true, message: 'Password berhasil diubah. Silakan login dengan password baru.' };
  }

  async getProfile(userId: number): Promise<AuthResponse> {
    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, sub_work_unit, home_address, phone_number, photo_path, created_at, updated_at, last_login, session_version, account_status, must_change_password, uml_access FROM users WHERE id = ?',
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

    if (payload.subWorkUnit !== undefined) {
      fields.push('sub_work_unit = ?');
      values.push(payload.subWorkUnit);
    }

    if (payload.homeAddress !== undefined) {
      fields.push('home_address = ?');
      values.push(payload.homeAddress);
    }

    if (payload.phoneNumber !== undefined) {
      if (payload.phoneNumber && !isValidPhoneNumber(payload.phoneNumber)) {
        return { success: false, message: 'Nomor WhatsApp/SMS tidak valid' };
      }
      fields.push('phone_number = ?');
      values.push(payload.phoneNumber ? normalizePhoneNumberForStorage(payload.phoneNumber) : null);
    }

    if (photoPath) {
      fields.push('photo_path = ?');
      values.push(photoPath);
    }

    if (fields.length === 0) {
      return { success: false, message: 'Tidak ada perubahan data' };
    }

    fields.push('updated_at = NOW()');
    values.push(userId);

    try {
      await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    } catch (error: any) {
      console.error(`[Service] Database error during profile update:`, error);
      if (error.code === 'ER_DUP_ENTRY') {
        return { success: false, message: 'NIP atau email sudah digunakan' };
      }
      return { success: false, message: 'Gagal memperbarui profil' };
    }

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, role, staff_access_type, gender, work_unit, sub_work_unit, home_address, phone_number, photo_path, created_at, updated_at, last_login, session_version, account_status, must_change_password, uml_access FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Pengguna tidak ditemukan' };
    }

    const updatedUser = this.mapRowToUser(rows[0]);

    return {
      success: true,
      message: 'Profil berhasil diperbarui',
      data: {
        user: updatedUser,
        token: ''
      }
    };
  }

  async invalidateUserSessions(userId: number): Promise<void> {
    await pool.query(
      'UPDATE users SET session_version = session_version + 1, updated_at = NOW() WHERE id = ?',
      [userId],
    );
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
      subWorkUnit: user.sub_work_unit,
      homeAddress: user.home_address,
      phoneNumber: user.phone_number,
      photoPath: user.photo_path,
      updatedAt: user.updated_at,
      sessionVersion: Number(user.session_version) || 0,
      accountStatus: user.account_status || 'active',
      mustChangePassword: Boolean(user.must_change_password),
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
