import { createHash, randomBytes } from 'crypto';
import redisClient from '../config/redis';

/** Penyedia OTP yang memegang siklus hidup kode untuk sesi ini. */
export type PasswordResetProvider = 'twilio' | 'local';

export interface PasswordResetSession {
  userId: number;
  nip: string;
  email: string;
  /** Hanya diisi ketika provider `local` membuat sendiri kodenya. */
  codeHash?: string;
  /** Nomor E.164 tujuan OTP, dipakai ulang saat verification check ke Twilio. */
  phoneNumber?: string;
  /** Tujuan tersamar yang ditampilkan ke pengguna, mis. `+628*******890`. */
  deliveryTarget?: string;
  provider: PasswordResetProvider;
  expiresAt: number;
  attemptsLeft: number;
  lastSentAt: number;
  resendCount: number;
}

export interface PasswordResetToken {
  userId: number;
  nip: string;
  expiresAt: number;
}

const PASSWORD_RESET_PREFIX = 'password_reset:';
const PASSWORD_RESET_TOKEN_PREFIX = 'password_reset_token:';
const memoryStore = new Map<string, PasswordResetSession>();
const memoryTokenStore = new Map<string, PasswordResetToken>();
const allowInMemoryStore =
  (process.env.NODE_ENV || 'development') !== 'production' ||
  process.env.ALLOW_IN_MEMORY_PASSWORD_RESET_STORE === 'true';

const buildKey = (nip: string): string => `${PASSWORD_RESET_PREFIX}${nip}`;

/** Token hanya disimpan sebagai hash agar isi Redis tidak bisa dipakai ulang. */
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const buildTokenKey = (token: string): string => `${PASSWORD_RESET_TOKEN_PREFIX}${hashToken(token)}`;

const getRemainingTtlInSeconds = (expiresAt: number): number => {
  const ttl = Math.ceil((expiresAt - Date.now()) / 1000);
  return ttl > 0 ? ttl : 0;
};

const pruneExpiredMemoryEntries = (): void => {
  const now = Date.now();

  for (const [key, session] of memoryStore.entries()) {
    if (session.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }

  for (const [key, token] of memoryTokenStore.entries()) {
    if (token.expiresAt <= now) {
      memoryTokenStore.delete(key);
    }
  }
};

export const savePasswordResetSession = async (session: PasswordResetSession): Promise<void> => {
  const key = buildKey(session.nip);
  const ttlSeconds = getRemainingTtlInSeconds(session.expiresAt);

  if (ttlSeconds <= 0) {
    await deletePasswordResetSession(session.nip);
    return;
  }

  if (redisClient.isReady) {
    await redisClient.set(key, JSON.stringify(session), { EX: ttlSeconds });
    return;
  }

  if (!allowInMemoryStore) {
    throw new Error('Redis wajib aktif untuk reset password di production');
  }

  pruneExpiredMemoryEntries();
  memoryStore.set(key, session);
};

export const getPasswordResetSession = async (nip: string): Promise<PasswordResetSession | null> => {
  const key = buildKey(nip);

  if (redisClient.isReady) {
    const rawValue = await redisClient.get(key);
    if (!rawValue) {
      return null;
    }

    const session = JSON.parse(rawValue) as PasswordResetSession;
    if (session.expiresAt <= Date.now()) {
      await deletePasswordResetSession(nip);
      return null;
    }

    return session;
  }

  if (!allowInMemoryStore) {
    return null;
  }

  pruneExpiredMemoryEntries();
  const session = memoryStore.get(key);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }

  return session;
};

export const deletePasswordResetSession = async (nip: string): Promise<void> => {
  const key = buildKey(nip);

  if (redisClient.isReady) {
    await redisClient.del(key);
    return;
  }

  if (!allowInMemoryStore) {
    return;
  }

  memoryStore.delete(key);
};

export const generatePasswordResetToken = (): string => randomBytes(32).toString('hex');

/**
 * Menyimpan bukti bahwa OTP sudah lolos verifikasi. Frontend hanya memegang
 * token acak ini; klaim "sudah terverifikasi" tidak pernah dipercaya dari sisi
 * klien.
 */
export const savePasswordResetToken = async (token: string, payload: PasswordResetToken): Promise<void> => {
  const key = buildTokenKey(token);
  const ttlSeconds = getRemainingTtlInSeconds(payload.expiresAt);

  if (ttlSeconds <= 0) {
    return;
  }

  if (redisClient.isReady) {
    await redisClient.set(key, JSON.stringify(payload), { EX: ttlSeconds });
    return;
  }

  if (!allowInMemoryStore) {
    throw new Error('Redis wajib aktif untuk reset password di production');
  }

  pruneExpiredMemoryEntries();
  memoryTokenStore.set(key, payload);
};

export const getPasswordResetToken = async (token: string): Promise<PasswordResetToken | null> => {
  const key = buildTokenKey(token);

  if (redisClient.isReady) {
    const rawValue = await redisClient.get(key);
    if (!rawValue) {
      return null;
    }

    const payload = JSON.parse(rawValue) as PasswordResetToken;
    if (payload.expiresAt <= Date.now()) {
      await redisClient.del(key);
      return null;
    }

    return payload;
  }

  if (!allowInMemoryStore) {
    return null;
  }

  pruneExpiredMemoryEntries();
  const payload = memoryTokenStore.get(key);
  if (!payload) {
    return null;
  }

  if (payload.expiresAt <= Date.now()) {
    memoryTokenStore.delete(key);
    return null;
  }

  return payload;
};

/** Menghapus token supaya hanya bisa dipakai satu kali. */
export const consumePasswordResetToken = async (token: string): Promise<void> => {
  const key = buildTokenKey(token);

  if (redisClient.isReady) {
    await redisClient.del(key);
    return;
  }

  if (!allowInMemoryStore) {
    return;
  }

  memoryTokenStore.delete(key);
};
