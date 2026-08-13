import { Request, Response } from 'express';
import { AuthService, PASSWORD_RESET_DELIVERY_FAILED_MESSAGE } from '../services/auth.service';
import { createScopedLogger } from '../utils/logger';
import {
    LoginCredentials,
    PasswordResetConfirmPayload,
    PasswordResetOtpVerifyPayload,
    PasswordResetRequestPayload,
    PasswordResetTokenPayload,
    RegisterCredentials
} from '../types/auth';

const logger = createScopedLogger('controller:auth');

const getAuthenticatedUserId = (req: Request): number | null => {
  const rawUserId = req.user?.id;
  if (rawUserId === undefined || rawUserId === null) {
    return null;
  }

  const parsedUserId = typeof rawUserId === 'number' ? rawUserId : Number(rawUserId);
  return Number.isFinite(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;
};

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Handle user login
   * POST /api/auth/login
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const credentials: LoginCredentials = req.body;
      const result = await this.authService.login(credentials);

      if (!result.success) {
        const statusCode = result.message === 'Akun tidak ditemukan' ? 404 : 401;
        res.status(statusCode).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Login error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Handle user registration
   * POST /api/auth/register
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const credentials: RegisterCredentials = req.body;
      const result = await this.authService.register(credentials);

      if (!result.success) {
        res.status(409).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      logger.error('Registration error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Verify NIP during password reset
   * POST /api/auth/reset-password/verify
   */
  verifyResetNip = async (req: Request, res: Response): Promise<void> => {
    await this.handlePasswordResetRequest(req, res, { isResend: false });
  };

  /**
   * Resend the password reset OTP, subject to a server-side cooldown
   * POST /api/auth/reset-password/resend
   */
  resendResetOtp = async (req: Request, res: Response): Promise<void> => {
    await this.handlePasswordResetRequest(req, res, { isResend: true });
  };

  private handlePasswordResetRequest = async (
    req: Request,
    res: Response,
    options: { isResend: boolean }
  ): Promise<void> => {
    try {
      const payload: PasswordResetRequestPayload = req.body;
      const result = await this.authService.requestPasswordResetCode(payload.nip, options);

      if (!result.success) {
        const serviceUnavailableMessages = [
          'Redis wajib aktif untuk reset password di production',
          'Layanan OTP WhatsApp/SMS belum dikonfigurasi di server.',
          'Pengiriman kode verifikasi gagal di semua channel WhatsApp/SMS. Periksa webhook OTP.',
          PASSWORD_RESET_DELIVERY_FAILED_MESSAGE,
        ];

        let statusCode = 400;
        if (serviceUnavailableMessages.includes(result.message)) {
          statusCode = 503;
        } else if (result.message.startsWith('Batas permintaan kode verifikasi tercapai')) {
          statusCode = 429;
        }

        res.status(statusCode).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Password reset request error', { error, isResend: options.isResend });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Exchange a valid OTP for a single-use reset token
   * POST /api/auth/reset-password/verify-otp
   */
  verifyResetOtp = async (req: Request, res: Response): Promise<void> => {
    try {
      const payload: PasswordResetOtpVerifyPayload = req.body;
      const result = await this.authService.verifyPasswordResetOtp(payload.nip, payload.verificationCode);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Verify reset OTP error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Reset password using a reset token, or the legacy NIP + OTP payload
   * POST /api/auth/reset-password
   */
  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Partial<PasswordResetTokenPayload & PasswordResetConfirmPayload>;
      const result = body.resetToken
        ? await this.authService.resetPasswordWithToken(body.resetToken, body.newPassword as string)
        : await this.authService.resetPasswordWithCode(body as PasswordResetConfirmPayload);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Reset password error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Handle user logout
   * POST /api/auth/logout
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    const userId = getAuthenticatedUserId(req);
    if (userId) {
      await this.authService.invalidateUserSessions(userId);
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });
  };

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getAuthenticatedUserId(req);
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      const result = await this.authService.getProfile(userId);
      
      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Get profile error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Update current user profile
   * PATCH /api/auth/me
   */
  updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const { name, email, nip, gender, workUnit, subWorkUnit, homeAddress, phoneNumber } = req.body;
      const file = req.file as Express.Multer.File | undefined;
      const photoPath = file ? `profiles/${file.filename}` : undefined;

      const result = await this.authService.updateProfile(userId, {
        name,
        email,
        nip,
        gender,
        workUnit,
        subWorkUnit,
        homeAddress,
        phoneNumber
      }, photoPath);

      if (!result.success) {
        logger.error('[Upload] Profile update failed', { message: result.message });
      }

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('[Upload] Update profile error', { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}

export default new AuthController();
