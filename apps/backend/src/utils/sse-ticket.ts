import crypto from 'crypto';
import redisClient from '../config/redis';

interface LocalTicket {
  userId: number;
  expiresAt: number;
}

const localTickets = new Map<string, LocalTicket>();
const isProduction = (process.env.NODE_ENV || 'development') === 'production';

const resolveTicketTtlSeconds = (): number => {
  const parsed = Number.parseInt(process.env.SSE_TICKET_TTL_SECONDS || '30', 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(Math.max(parsed, 10), 120);
};

const ticketKey = (ticket: string): string => {
  const digest = crypto.createHash('sha256').update(ticket).digest('hex');
  return `sipena:sse-ticket:${digest}`;
};

export const createSseTicket = async (userId: number): Promise<{ ticket: string; expiresIn: number }> => {
  const ticket = crypto.randomBytes(32).toString('base64url');
  const expiresIn = resolveTicketTtlSeconds();
  const key = ticketKey(ticket);

  if (redisClient.isReady) {
    await redisClient.setEx(key, expiresIn, String(userId));
  } else {
    if (isProduction) {
      throw new Error('Redis tidak tersedia untuk membuat tiket notifikasi');
    }
    localTickets.set(key, { userId, expiresAt: Date.now() + expiresIn * 1000 });
  }

  return { ticket, expiresIn };
};

export const consumeSseTicket = async (ticket: string): Promise<number | null> => {
  if (!ticket || ticket.length > 256) return null;

  const key = ticketKey(ticket);
  if (redisClient.isReady) {
    const value = await redisClient.sendCommand(['GETDEL', key]);
    const userId = Number(value);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
  }

  if (isProduction) return null;

  const stored = localTickets.get(key);
  localTickets.delete(key);
  if (!stored || stored.expiresAt < Date.now()) return null;
  return stored.userId;
};
