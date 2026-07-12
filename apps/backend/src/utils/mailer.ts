import nodemailer from 'nodemailer';

interface PasswordResetEmailPayload {
  to: string;
  name: string;
  code: string;
  expiresInMinutes: number;
}

export interface MailDeliveryResult {
  preview: boolean;
}

export const isPasswordResetPreviewMode = (): boolean => {
  return (process.env.NODE_ENV || 'development') !== 'production';
};

let cachedTransporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter | null => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !user || !pass) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user,
      pass
    }
  });

  return cachedTransporter;
};

export const sendPasswordResetCodeEmail = async ({
  to,
  name,
  code,
  expiresInMinutes
}: PasswordResetEmailPayload): Promise<MailDeliveryResult> => {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM?.trim()
    || process.env.EMAIL_FROM?.trim()
    || process.env.SMTP_USER?.trim();

  if (!transporter || !from) {
    if (isPasswordResetPreviewMode()) {
      console.log(`[DEV][RESET PASSWORD] kode verifikasi untuk ${to}: ${code}`);
      return { preview: true };
    }

    throw new Error('Konfigurasi email reset password belum lengkap');
  }

  await transporter.sendMail({
    from,
    to,
    subject: 'Kode Verifikasi Reset Password SiPeNa',
    text: `Halo ${name}, kode verifikasi reset password Anda adalah ${code}. Kode ini berlaku selama ${expiresInMinutes} menit.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h2 style="margin-bottom: 8px;">Reset Password SiPeNa</h2>
        <p>Halo ${name},</p>
        <p>Gunakan kode verifikasi berikut untuk mengganti password akun Anda:</p>
        <div style="display: inline-block; padding: 12px 18px; font-size: 24px; font-weight: 700; letter-spacing: 6px; background: #ecfeff; color: #0f766e; border-radius: 12px;">
          ${code}
        </div>
        <p style="margin-top: 16px;">Kode ini berlaku selama ${expiresInMinutes} menit. Jangan bagikan kode ini kepada siapa pun.</p>
      </div>
    `
  });

  return { preview: false };
};
