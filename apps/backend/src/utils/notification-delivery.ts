import { createScopedLogger } from './logger';

const logger = createScopedLogger('utils:notification-delivery');

interface PhoneNotificationPayload {
  phoneNumber: string;
  userName?: string;
  title: string;
  message: string;
  referenceCode?: string;
  referenceType?: string;
  link?: string;
  // Batasi kanal yang dicoba. Default: WhatsApp lalu SMS sebagai cadangan.
  channels?: Array<'whatsapp' | 'sms'>;
}

export interface PhoneNotificationResult {
  channel: 'whatsapp' | 'sms' | 'local_preview';
  preview: boolean;
  deliveryTarget: string;
}

const NOTIFICATION_TIMEOUT_MS = 10000;

const maskPhoneNumber = (value: string): string => {
  const normalized = value.trim();
  if (normalized.length <= 6) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}${'*'.repeat(Math.max(normalized.length - 7, 3))}${normalized.slice(-3)}`;
};

const postWebhook = async (url: string, token: string | undefined, body: Record<string, unknown>): Promise<void> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NOTIFICATION_TIMEOUT_MS);

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
      throw new Error(`Webhook notifikasi gagal (${response.status})${raw ? `: ${raw}` : ''}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
};

export const sendPhoneNotification = async ({
  phoneNumber,
  userName,
  title,
  message,
  referenceCode,
  referenceType,
  link,
  channels,
}: PhoneNotificationPayload): Promise<PhoneNotificationResult> => {
  const normalizedPhoneNumber = phoneNumber.trim();
  const deliveryTarget = maskPhoneNumber(normalizedPhoneNumber);
  const isProduction = (process.env.NODE_ENV || 'development') === 'production';
  const brandName = process.env.NOTIFICATION_BRAND_NAME?.trim() || process.env.OTP_BRAND_NAME?.trim() || 'SiPeNa';

  const whatsappWebhookUrl = process.env.WHATSAPP_NOTIFICATION_WEBHOOK_URL?.trim() || process.env.WHATSAPP_OTP_WEBHOOK_URL?.trim();
  const whatsappWebhookToken = process.env.WHATSAPP_NOTIFICATION_WEBHOOK_TOKEN?.trim() || process.env.WHATSAPP_OTP_WEBHOOK_TOKEN?.trim();
  const smsWebhookUrl = process.env.SMS_NOTIFICATION_WEBHOOK_URL?.trim() || process.env.SMS_OTP_WEBHOOK_URL?.trim();
  const smsWebhookToken = process.env.SMS_NOTIFICATION_WEBHOOK_TOKEN?.trim() || process.env.SMS_OTP_WEBHOOK_TOKEN?.trim();

  const basePayload = {
    to: normalizedPhoneNumber,
    brandName,
    userName,
    title,
    message,
    referenceCode,
    referenceType,
    link,
  };

  const allowedChannels = channels && channels.length > 0 ? channels : ['whatsapp', 'sms'];
  const attempts: Array<{ channel: 'whatsapp' | 'sms'; url?: string; token?: string }> = [
    { channel: 'whatsapp' as const, url: whatsappWebhookUrl, token: whatsappWebhookToken },
    { channel: 'sms' as const, url: smsWebhookUrl, token: smsWebhookToken },
  ].filter((attempt) => allowedChannels.includes(attempt.channel));

  const configuredAttempts = attempts.filter(
    (attempt): attempt is { channel: 'whatsapp' | 'sms'; url: string; token?: string } => Boolean(attempt.url)
  );

  if (configuredAttempts.length === 0) {
    if (!isProduction) {
      logger.debug('[DEV][NOTIF] message preview', { title, to: normalizedPhoneNumber, message });
      return {
        channel: 'local_preview',
        preview: true,
        deliveryTarget,
      };
    }

    throw new Error('Layanan notifikasi WhatsApp/SMS belum dikonfigurasi di server.');
  }

  for (const attempt of configuredAttempts) {
    try {
      await postWebhook(attempt.url, attempt.token, { ...basePayload, channel: attempt.channel });
      return {
        channel: attempt.channel,
        preview: false,
        deliveryTarget,
      };
    } catch (error) {
      logger.error('[NOTIF] Pengiriman gagal', { channel: attempt.channel, error });
    }
  }

  if (!isProduction) {
    logger.debug('[DEV][NOTIF] message preview', { title, to: normalizedPhoneNumber, message });
    return {
      channel: 'local_preview',
      preview: true,
      deliveryTarget,
    };
  }

  throw new Error('Pengiriman notifikasi gagal di semua channel WhatsApp/SMS.');
};