import bcrypt from 'bcryptjs';
import { createHmac, randomInt } from 'crypto';
import jwt from 'jsonwebtoken';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { createScopedLogger } from '../utils/logger';
import {
    AuthResponse,
    LoginCredentials,
    PasswordResetConfirmPayload,
    RegisterCredentials,
    User
} from '../types/auth';
import { sendPhoneNotification } from '../utils/notification-delivery';
import {
    isValidPhoneNumber,
    maskPhoneNumber,
    normalizePhoneNumberForStorage,
    sendPasswordResetOtp,
} from '../utils/otp-delivery';
import {
    consumePasswordResetToken,
    deletePasswordResetSession,
    generatePasswordResetToken,
    getPasswordResetSession,
    getPasswordResetToken,
    savePasswordResetSession,
    savePasswordResetToken,
    type PasswordResetSession
} from '../utils/password-reset-store';
import {
    checkVerificationCode,
    isTwilioVerifyConfigured,
    sendVerificationCode
} from './otp/twilio.service';

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
    expiresInMinutes: number;
    resendAvailableInSeconds?: number;
    /** Hanya diisi pada preview pengembangan. */
    deliveryTarget?: string;
    deliveryMethod?: 'whatsapp' | 'sms' | 'email' | 'local_preview';
    previewCode?: string;
  };
}

interface PasswordResetOtpVerifyResponse {
  success: boolean;
  message: string;
  data?: {
    resetToken: string;
    expiresInMinutes: number;
  };
}

/** Hasil pengecekan OTP sebelum password benar-benar diubah. */
interface ResetVerificationResult {
  success: boolean;
  message: string;
  userId?: number;
  nip?: string;
}

const logger = createScopedLogger('service:auth');

/** Dipakai controller untuk memetakan kegagalan kanal OTP ke status 503. */
export const PASSWORD_RESET_DELIVERY_FAILED_MESSAGE =
  'Pengiriman kode verifikasi gagal. Periksa konfigurasi Twilio Verify atau webhook WhatsApp/SMS.';

export class AuthService {
  private static readonly PASSWORD_RESET_EXPIRES_IN_MINUTES = 10;
  private static readonly PASSWORD_RESET_MAX_ATTEMPTS = 5;
  private static readonly MAX_FAILED_LOGIN_ATTEMPTS = 5;
  private static readonly ACCOUNT_LOCK_DURATION_MINUTES = 15;
  private static readonly PASSWORD_RESET_REQUEST_MESSAGE =
    'Jika data Anda terdaftar, kode verifikasi akan dikirim melalui kanal yang tersedia.';
  private static readonly PASSWORD_RESET_RESEND_COOLDOWN_SECONDS = 60;
  private static readonly PASSWORD_RESET_MAX_RESENDS = 3;
  private static readonly PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES = 10;
  private static readonly PASSWORD_RESET_INVALID_CODE_MESSAGE =
    'Kode verifikasi tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.';

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
      // Nomor telepon kini satu-satunya kanal OTP, jadi akun lama yang belum
      // mengisinya harus dipandu melengkapi sebelum sempat lupa password.
      mustCompletePhoneNumber: !row.phone_number || !isValidPhoneNumber(row.phone_number),
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

  async requestPasswordResetCode(nip: string, options: { isResend?: boolean } = {}): Promise<PasswordResetRequestResponse> {
    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, nip, name, email, phone_number, account_status FROM users WHERE nip = ?',
      [nip]
    );

    const now = Date.now();
    const expiresAt = now + (AuthService.PASSWORD_RESET_EXPIRES_IN_MINUTES * 60 * 1000);
    const user = rows.length > 0 ? rows[0] : null;
    const normalizedPhoneNumber = user?.phone_number ? normalizePhoneNumberForStorage(user.phone_number) : '';
    const hasUsablePhoneNumber = Boolean(normalizedPhoneNumber) && isValidPhoneNumber(normalizedPhoneNumber);
    // Akun nonaktif/ditangguhkan tidak boleh memulihkan akses sendiri, dan akun
    // tanpa nomor terdaftar tidak punya kanal OTP sama sekali. Keduanya ditolak
    // dengan tampilan yang sama persis dengan NIP yang tidak terdaftar.
    const isEligible =
      Boolean(user) && (user!.account_status || 'active') === 'active' && hasUsablePhoneNumber;
    const sessionKey = user?.nip ?? nip;
    const previousSession = await getPasswordResetSession(sessionKey).catch(() => null);
    const cooldownRemaining = this.getResendCooldownRemaining(previousSession, now);

    // Cooldown dan batas kirim ulang dievaluasi sebelum akun diperiksa, dan
    // jawabannya identik untuk NIP terdaftar maupun tidak, supaya endpoint ini
    // tidak bisa dipakai menebak NIP mana yang ada di sistem.
    if (cooldownRemaining > 0) {
      return {
        success: true,
        message: `${AuthService.PASSWORD_RESET_REQUEST_MESSAGE} Kode baru dapat diminta dalam ${cooldownRemaining} detik.`,
        data: {
          deliveryTarget: previousSession?.deliveryTarget ?? this.buildDecoyDeliveryTarget(sessionKey),
          expiresInMinutes: AuthService.PASSWORD_RESET_EXPIRES_IN_MINUTES,
          resendAvailableInSeconds: cooldownRemaining
        }
      };
    }

    if (previousSession && previousSession.resendCount >= AuthService.PASSWORD_RESET_MAX_RESENDS) {
      return {
        success: false,
        message: 'Batas permintaan kode verifikasi tercapai. Silakan coba lagi setelah 10 menit.'
      };
    }

    const resendCount = options.isResend && previousSession ? previousSession.resendCount + 1 : 0;

    if (!user || !isEligible) {
      if (user && !hasUsablePhoneNumber) {
        logger.warn('[RESET_PASSWORD] Akun tanpa nomor telepon valid tidak dapat menerima OTP', {
          userId: user.id,
        });
      }

      // Sesi umpan: tidak memuat kode apa pun, hanya menyamakan perilaku
      // cooldown agar selisih waktu balasan tidak membocorkan keberadaan akun.
      const decoyTarget = this.buildDecoyDeliveryTarget(sessionKey);

      await savePasswordResetSession({
        userId: 0,
        nip: sessionKey,
        email: '',
        provider: 'local',
        deliveryTarget: decoyTarget,
        expiresAt,
        attemptsLeft: AuthService.PASSWORD_RESET_MAX_ATTEMPTS,
        lastSentAt: now,
        resendCount
      }).catch((error) => logger.error('Save decoy password reset session error', { error }));

      return {
        success: true,
        message: AuthService.PASSWORD_RESET_REQUEST_MESSAGE,
        data: {
          deliveryTarget: decoyTarget,
          expiresInMinutes: AuthService.PASSWORD_RESET_EXPIRES_IN_MINUTES,
          resendAvailableInSeconds: AuthService.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS
        }
      };
    }

    // Twilio Verify adalah kanal utama bila dikonfigurasi: Twilio yang membuat,
    // mengirim, dan memvalidasi kodenya sehingga tidak ada OTP yang disimpan
    // aplikasi. Webhook WhatsApp/SMS di bawah menjadi cadangan.
    if (isTwilioVerifyConfigured()) {
      try {
        const twilioDelivery = await sendVerificationCode(normalizedPhoneNumber);
        const deliveryTarget = maskPhoneNumber(normalizedPhoneNumber);

        await savePasswordResetSession({
          userId: user.id,
          nip: user.nip,
          email: user.email,
          phoneNumber: normalizedPhoneNumber,
          provider: 'twilio',
          deliveryTarget,
          expiresAt,
          attemptsLeft: AuthService.PASSWORD_RESET_MAX_ATTEMPTS,
          lastSentAt: now,
          resendCount
        });

        logger.info('Password reset OTP dikirim via Twilio Verify', {
          userId: user.id,
          channel: twilioDelivery.channel,
          target: deliveryTarget,
        });

        // Nama kanal tetap tidak dikirim ke klien: `sms` versus `email` sudah
        // cukup untuk menyimpulkan apakah sebuah NIP punya nomor terdaftar.
        return {
          success: true,
          message: AuthService.PASSWORD_RESET_REQUEST_MESSAGE,
          data: {
            deliveryTarget,
            expiresInMinutes: AuthService.PASSWORD_RESET_EXPIRES_IN_MINUTES,
            resendAvailableInSeconds: AuthService.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS
          }
        };
      } catch (error) {
        logger.error('Twilio Verify send error, fallback ke kanal lain', { error });
      }
    }

    const verificationCode = this.generateVerificationCode();
    const codeHash = await bcrypt.hash(verificationCode, 10);

    try {
      await savePasswordResetSession({
        userId: user.id,
        nip: user.nip,
        email: user.email,
        codeHash,
        provider: 'local',
        expiresAt,
        attemptsLeft: AuthService.PASSWORD_RESET_MAX_ATTEMPTS,
        lastSentAt: now,
        resendCount
      });
    } catch (error) {
      logger.error('Save password reset session error', { error });
      return {
        success: false,
        message: error instanceof Error
          ? error.message
          : 'Sesi reset password gagal disiapkan. Coba lagi beberapa saat.'
      };
    }

    // OTP hanya dikirim ke nomor terdaftar. Email sudah tidak dipakai sebagai
    // kanal OTP: bentuk tujuannya membocorkan akun mana yang tidak punya nomor,
    // dan kotak surat yang ikut jebol membuat SMS/WhatsApp tidak lagi menjadi
    // faktor terpisah dari password.
    let phoneDelivery: Awaited<ReturnType<typeof sendPasswordResetOtp>> | null = null;

    try {
      phoneDelivery = await sendPasswordResetOtp({
        phoneNumber: normalizedPhoneNumber,
        userName: user.name,
        code: verificationCode,
        expiresInMinutes: AuthService.PASSWORD_RESET_EXPIRES_IN_MINUTES,
      });
    } catch (error) {
      logger.error('Send password reset OTP error', { error });
    }

    if (!phoneDelivery) {
      await deletePasswordResetSession(user.nip).catch(() => undefined);
      return {
        success: false,
        message: PASSWORD_RESET_DELIVERY_FAILED_MESSAGE
      };
    }

    const selectedDelivery = { target: phoneDelivery.deliveryTarget };
    const previewOnly = phoneDelivery.preview;

    // Target disimpan agar permintaan berikutnya yang tertahan cooldown tetap
    // menampilkan tujuan yang sama.
    await savePasswordResetSession({
      userId: user.id,
      nip: user.nip,
      email: user.email,
      codeHash,
      provider: 'local',
      deliveryTarget: selectedDelivery.target,
      expiresAt,
      attemptsLeft: AuthService.PASSWORD_RESET_MAX_ATTEMPTS,
      lastSentAt: now,
      resendCount
    }).catch((error) => logger.error('Update password reset session target error', { error }));

    return {
      success: true,
      message: previewOnly
        ? 'Kode verifikasi tersedia di preview lokal pengembangan.'
        : AuthService.PASSWORD_RESET_REQUEST_MESSAGE,
      // Nama kanal dan kode hanya dibuka pada preview pengembangan.
      data: previewOnly
        ? {
            deliveryTarget: selectedDelivery.target,
            expiresInMinutes: AuthService.PASSWORD_RESET_EXPIRES_IN_MINUTES,
            deliveryMethod: 'local_preview',
            previewCode: verificationCode,
            resendAvailableInSeconds: AuthService.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS,
          }
        : {
            deliveryTarget: selectedDelivery.target,
            expiresInMinutes: AuthService.PASSWORD_RESET_EXPIRES_IN_MINUTES,
            resendAvailableInSeconds: AuthService.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS,
          }
    };
  }

  /**
   * Tujuan tersamar untuk NIP yang tidak berhak menerima kode. Bentuknya
   * disamakan dengan hasil `maskPhoneNumber` dan diturunkan secara deterministik
   * dari NIP, sehingga permintaan berulang selalu menampilkan nilai yang sama
   * dan tidak bisa dibedakan dari akun sungguhan.
   */
  private buildDecoyDeliveryTarget(nip: string): string {
    const secret = process.env.JWT_SECRET || 'sipena-password-reset-decoy';
    const digest = createHmac('sha256', secret).update(`reset-target:${nip}`).digest();
    const lastDigits = String(digest.readUInt16BE(0) % 1000).padStart(3, '0');

    return `+628${'*'.repeat(7)}${lastDigits}`;
  }

  /** Sisa cooldown kirim ulang OTP dalam detik; 0 bila sudah boleh dikirim. */
  private getResendCooldownRemaining(session: PasswordResetSession | null, now: number): number {
    if (!session?.lastSentAt) {
      return 0;
    }

    const elapsedSeconds = Math.floor((now - session.lastSentAt) / 1000);
    const remaining = AuthService.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS - elapsedSeconds;
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Memvalidasi OTP terhadap provider yang dipakai sesi ini. Sesi hanya
   * dihapus ketika kode benar atau jatah percobaan habis.
   */
  private async consumeResetVerification(nip: string, verificationCode: string): Promise<ResetVerificationResult> {
    const [rows] = await pool.query<UserRow[]>(
      'SELECT id FROM users WHERE nip = ?',
      [nip]
    );

    if (rows.length === 0) {
      return { success: false, message: AuthService.PASSWORD_RESET_INVALID_CODE_MESSAGE };
    }

    const user = rows[0];
    const session = await getPasswordResetSession(nip);

    if (!session || session.userId !== user.id) {
      return { success: false, message: AuthService.PASSWORD_RESET_INVALID_CODE_MESSAGE };
    }

    let isValidCode = false;

    if (session.provider === 'twilio' && session.phoneNumber) {
      try {
        isValidCode = (await checkVerificationCode(session.phoneNumber, verificationCode)) === 'approved';
      } catch (error) {
        logger.error('Twilio Verify check error', { error });
        return {
          success: false,
          message: 'Verifikasi kode gagal diproses. Coba lagi beberapa saat.'
        };
      }
    } else if (session.codeHash) {
      isValidCode = await bcrypt.compare(verificationCode, session.codeHash);
    }

    if (!isValidCode) {
      const nextAttemptsLeft = session.attemptsLeft - 1;
      if (nextAttemptsLeft <= 0) {
        await deletePasswordResetSession(nip);
      } else {
        await savePasswordResetSession({ ...session, attemptsLeft: nextAttemptsLeft });
      }

      return { success: false, message: AuthService.PASSWORD_RESET_INVALID_CODE_MESSAGE };
    }

    await deletePasswordResetSession(nip);

    return { success: true, message: 'Kode verifikasi valid.', userId: user.id, nip: session.nip };
  }

  /**
   * Menukar OTP yang benar dengan reset token sekali pakai. Frontend tidak
   * pernah menjadi sumber kebenaran status "terverifikasi".
   */
  async verifyPasswordResetOtp(nip: string, verificationCode: string): Promise<PasswordResetOtpVerifyResponse> {
    const verification = await this.consumeResetVerification(nip, verificationCode);

    if (!verification.success || !verification.userId) {
      return { success: false, message: verification.message };
    }

    const resetToken = generatePasswordResetToken();

    try {
      await savePasswordResetToken(resetToken, {
        userId: verification.userId,
        nip: verification.nip ?? nip,
        expiresAt: Date.now() + (AuthService.PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES * 60 * 1000)
      });
    } catch (error) {
      logger.error('Save password reset token error', { error });
      return {
        success: false,
        message: error instanceof Error
          ? error.message
          : 'Sesi reset password gagal disiapkan. Coba lagi beberapa saat.'
      };
    }

    return {
      success: true,
      message: 'Kode verifikasi berhasil diverifikasi.',
      data: {
        resetToken,
        expiresInMinutes: AuthService.PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES
      }
    };
  }

  private async applyNewPassword(userId: number, newPassword: string): Promise<AuthResponse> {
    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, name, password, phone_number FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Pengguna tidak ditemukan' };
    }

    const user = rows[0];

    if (await bcrypt.compare(newPassword, user.password)) {
      return { success: false, message: 'Password baru tidak boleh sama dengan password lama.' };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    // Reset yang berhasil sekaligus membuka kunci akun: pengguna yang terkunci
    // karena salah password justru datang lewat jalur ini.
    await pool.query(
      `UPDATE users
       SET password = ?, must_change_password = 0, session_version = session_version + 1,
           failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
       WHERE id = ?`,
      [hashedPassword, userId],
    );

    logger.info('Password berhasil direset', { userId });
    await this.notifyPasswordChanged(user);

    return { success: true, message: 'Password berhasil diubah. Silakan login dengan password baru.' };
  }

  /**
   * Memberi tahu pemilik akun bahwa passwordnya berubah, supaya reset yang
   * tidak dia lakukan bisa segera disadari. Kegagalan kirim tidak boleh
   * membatalkan reset yang sudah tersimpan.
   */
  private async notifyPasswordChanged(user: Pick<UserRow, 'id' | 'name' | 'phone_number'>): Promise<void> {
    if (!user.phone_number || !isValidPhoneNumber(user.phone_number)) {
      return;
    }

    try {
      await sendPhoneNotification({
        phoneNumber: normalizePhoneNumberForStorage(user.phone_number),
        userName: user.name,
        title: 'Password berhasil diubah',
        message:
          'Password akun SiPeNa Anda baru saja diubah. Jika bukan Anda yang melakukannya, segera hubungi admin.',
        referenceType: 'password_reset',
      });
    } catch (error) {
      logger.error('Gagal mengirim notifikasi perubahan password', { userId: user.id, error });
    }
  }

  /** Jalur utama: reset token sekali pakai hasil `verifyPasswordResetOtp`. */
  async resetPasswordWithToken(resetToken: string, newPassword: string): Promise<AuthResponse> {
    const tokenPayload = await getPasswordResetToken(resetToken);

    if (!tokenPayload) {
      return {
        success: false,
        message: 'Sesi reset password tidak valid atau sudah kedaluwarsa. Silakan ulangi dari awal.'
      };
    }

    // Token dikonsumsi lebih dulu supaya satu token tidak bisa dipakai dua kali
    // walaupun ada dua permintaan yang datang bersamaan.
    await consumePasswordResetToken(resetToken);

    const result = await this.applyNewPassword(tokenPayload.userId, newPassword);
    await deletePasswordResetSession(tokenPayload.nip).catch(() => undefined);

    return result;
  }

  /** Jalur lama: OTP dan password baru dikirim sekaligus dalam satu request. */
  async resetPasswordWithCode(payload: PasswordResetConfirmPayload): Promise<AuthResponse> {
    const { nip, verificationCode, newPassword } = payload;
    const verification = await this.consumeResetVerification(nip, verificationCode);

    if (!verification.success || !verification.userId) {
      return { success: false, message: verification.message };
    }

    return this.applyNewPassword(verification.userId, newPassword);
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
      // Nomor tidak boleh dikosongkan: itu satu-satunya kanal pemulihan akun.
      if (!payload.phoneNumber) {
        return { success: false, message: 'Nomor WhatsApp/SMS wajib diisi dan tidak boleh dikosongkan' };
      }

      if (!isValidPhoneNumber(payload.phoneNumber)) {
        return { success: false, message: 'Nomor WhatsApp/SMS tidak valid' };
      }

      fields.push('phone_number = ?');
      values.push(normalizePhoneNumberForStorage(payload.phoneNumber));
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
      logger.error('[Service] Database error during profile update', { error });
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
      mustCompletePhoneNumber: !user.phone_number || !isValidPhoneNumber(user.phone_number),
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
