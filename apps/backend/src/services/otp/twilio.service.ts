import twilio, { Twilio } from 'twilio';
import { createScopedLogger } from '../../utils/logger';

const logger = createScopedLogger('service:otp:twilio');

export type TwilioVerifyChannel = 'sms' | 'whatsapp';

export type TwilioVerifyStatus = 'pending' | 'approved' | 'canceled' | 'expired' | 'max_attempts_reached';

export interface TwilioVerifyConfig {
  accountSid: string;
  authToken: string;
  verifyServiceSid: string;
  channel: TwilioVerifyChannel;
}

const readTrimmedEnv = (key: string): string | undefined => process.env[key]?.trim() || undefined;

const readChannel = (): TwilioVerifyChannel => {
  const raw = readTrimmedEnv('TWILIO_VERIFY_CHANNEL')?.toLowerCase();
  return raw === 'whatsapp' ? 'whatsapp' : 'sms';
};

/**
 * Membaca kredensial Twilio Verify dari environment. Mengembalikan `null`
 * bila salah satu nilai wajib belum diisi sehingga pemanggil dapat jatuh ke
 * channel OTP lain (webhook WhatsApp/SMS atau email).
 */
export const getTwilioVerifyConfig = (): TwilioVerifyConfig | null => {
  const accountSid = readTrimmedEnv('TWILIO_ACCOUNT_SID');
  const authToken = readTrimmedEnv('TWILIO_AUTH_TOKEN');
  const verifyServiceSid = readTrimmedEnv('TWILIO_VERIFY_SERVICE_SID');

  if (!accountSid || !authToken || !verifyServiceSid) {
    return null;
  }

  return { accountSid, authToken, verifyServiceSid, channel: readChannel() };
};

export const isTwilioVerifyConfigured = (): boolean => getTwilioVerifyConfig() !== null;

let cachedClient: Twilio | null = null;
let cachedClientSignature = '';

const getClient = (config: TwilioVerifyConfig): Twilio => {
  const signature = `${config.accountSid}:${config.authToken}`;

  if (!cachedClient || cachedClientSignature !== signature) {
    cachedClient = twilio(config.accountSid, config.authToken);
    cachedClientSignature = signature;
  }

  return cachedClient;
};

export interface TwilioVerifyResult {
  status: TwilioVerifyStatus;
  channel: TwilioVerifyChannel;
}

/**
 * Meminta Twilio Verify membuat dan mengirim kode verifikasi. Kode tidak
 * pernah kembali ke aplikasi, jadi tidak ada OTP plaintext yang perlu
 * disimpan di database maupun Redis.
 */
export const sendVerificationCode = async (
  phoneNumber: string,
  channel?: TwilioVerifyChannel,
): Promise<TwilioVerifyResult> => {
  const config = getTwilioVerifyConfig();
  if (!config) {
    throw new Error('Twilio Verify belum dikonfigurasi di server.');
  }

  const selectedChannel = channel ?? config.channel;
  const verification = await getClient(config)
    .verify.v2.services(config.verifyServiceSid)
    .verifications.create({ to: phoneNumber, channel: selectedChannel });

  // Status dan SID aman untuk dicatat; kode OTP tidak pernah ikut di-log.
  logger.info('Twilio Verify verification created', {
    sid: verification.sid,
    status: verification.status,
    channel: selectedChannel,
  });

  return { status: verification.status as TwilioVerifyStatus, channel: selectedChannel };
};

/**
 * Memvalidasi kode yang diketik pengguna ke Twilio Verify. Twilio yang
 * memegang masa berlaku dan batas percobaan kode tersebut.
 */
export const checkVerificationCode = async (
  phoneNumber: string,
  code: string,
): Promise<TwilioVerifyStatus> => {
  const config = getTwilioVerifyConfig();
  if (!config) {
    throw new Error('Twilio Verify belum dikonfigurasi di server.');
  }

  try {
    const check = await getClient(config)
      .verify.v2.services(config.verifyServiceSid)
      .verificationChecks.create({ to: phoneNumber, code });

    return check.status as TwilioVerifyStatus;
  } catch (error) {
    // Twilio membalas 404 ketika verification sudah kedaluwarsa, terpakai,
    // atau mencapai batas percobaan. Perlakukan sebagai kode tidak valid.
    if (typeof error === 'object' && error !== null && (error as { status?: number }).status === 404) {
      logger.warn('Twilio Verify check ditolak: verification tidak ditemukan atau kedaluwarsa');
      return 'expired';
    }

    throw error;
  }
};
