import redisClient from '../config/redis';

export interface PasswordResetSession {
  userId: number;
  nip: string;
  email: string;
  codeHash: string;
  expiresAt: number;
  attemptsLeft: number;
}

const PASSWORD_RESET_PREFIX = 'password_reset:';
const memoryStore = new Map<string, PasswordResetSession>();

const buildKey = (nip: string): string => `${PASSWORD_RESET_PREFIX}${nip}`;

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

  memoryStore.delete(key);
};
