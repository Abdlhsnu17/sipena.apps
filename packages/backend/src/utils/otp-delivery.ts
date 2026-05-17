interface OtpDeliveryPayload {
  phoneNumber: string;
  code: string;
  expiresInMinutes: number;
  userName: string;
}

export interface OtpDeliveryResult {
  channel: 'whatsapp' | 'sms' | 'local_preview';
  preview: boolean;
  deliveryTarget: string;
}

const OTP_TIMEOUT_MS = 10000;

const normalizePhoneNumber = (value: string): string => {
  const cleaned = value.replace(/[^\d+]/g, '');
  if (!cleaned) {
    return '';
  }

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  if (cleaned.startsWith('62')) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith('0')) {
    return `+62${cleaned.slice(1)}`;
  }

  return `+${cleaned}`;
};

export const normalizePhoneNumberForStorage = (value: string): string => normalizePhoneNumber(value);

export const isValidPhoneNumber = (value: string): boolean => {
  const normalized = normalizePhoneNumber(value);
  return /^\+[1-9]\d{9,15}$/.test(normalized);
};

const maskPhoneNumber = (value: string): string => {
  const normalized = normalizePhoneNumber(value);
  if (normalized.length <= 6) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}${'*'.repeat(Math.max(normalized.length - 7, 3))}${normalized.slice(-3)}`;
};

const postWebhook = async (url: string, token: string | undefined, body: Record<string, unknown>): Promise<void> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OTP_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      throw new Error(`Webhook OTP gagal (${response.status})${raw ? `: ${raw}` : ''}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
};

export const sendPasswordResetOtp = async ({
  phoneNumber,
  code,
  expiresInMinutes,
  userName,
}: OtpDeliveryPayload): Promise<OtpDeliveryResult> => {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const deliveryTarget = maskPhoneNumber(normalizedPhoneNumber);
  const isProduction = (process.env.NODE_ENV || 'development') === 'production';
  const brandName = process.env.OTP_BRAND_NAME?.trim() || 'SiPeNa';

  const whatsappWebhookUrl = process.env.WHATSAPP_OTP_WEBHOOK_URL?.trim();
  const whatsappWebhookToken = process.env.WHATSAPP_OTP_WEBHOOK_TOKEN?.trim();
  const smsWebhookUrl = process.env.SMS_OTP_WEBHOOK_URL?.trim();
  const smsWebhookToken = process.env.SMS_OTP_WEBHOOK_TOKEN?.trim();

  const basePayload = {
    to: normalizedPhoneNumber,
    code,
    expiresInMinutes,
    brandName,
    userName,
    message: `${brandName}: kode OTP reset password Anda adalah ${code}. Berlaku ${expiresInMinutes} menit.`,
  };

  const attempts: Array<{ channel: 'whatsapp' | 'sms'; url?: string; token?: string }> = [
    { channel: 'whatsapp', url: whatsappWebhookUrl, token: whatsappWebhookToken },
    { channel: 'sms', url: smsWebhookUrl, token: smsWebhookToken },
  ];

  for (const attempt of attempts) {
    if (!attempt.url) {
      continue;
    }

    try {
      await postWebhook(attempt.url, attempt.token, { ...basePayload, channel: attempt.channel });
      return {
        channel: attempt.channel,
        preview: false,
        deliveryTarget,
      };
    } catch (error) {
      console.error(`[OTP] Pengiriman ${attempt.channel} gagal:`, error);
    }
  }

  if (!isProduction) {
    console.log(`[DEV][RESET OTP] kode verifikasi untuk ${normalizedPhoneNumber}: ${code}`);
    return {
      channel: 'local_preview',
      preview: true,
      deliveryTarget,
    };
  }

  throw new Error('Pengiriman kode verifikasi gagal di semua channel');
};
