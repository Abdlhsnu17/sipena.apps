import { Response } from 'express';
import { createScopedLogger } from './logger';

const logger = createScopedLogger('notification-stream');

interface StreamClient {
  id: number;
  res: Response;
}

/**
 * In-memory hub that keeps track of active Server-Sent Events (SSE) connections
 * per user so freshly created notifications can be pushed in real time instead
 * of relying solely on client polling.
 *
 * Connections live only in the current process. When the backend runs behind
 * multiple instances each instance only pushes to the clients it holds; the
 * frontend keeps a slow polling fallback so nothing is ever lost.
 */
class NotificationStreamHub {
  private readonly clientsByUser = new Map<number, Set<StreamClient>>();
  private nextClientId = 1;

  /**
   * Register a new SSE response for a user. Returns a cleanup function that must
   * be called when the connection closes.
   */
  addClient(userId: number, res: Response): () => void {
    const client: StreamClient = { id: this.nextClientId++, res };
    let set = this.clientsByUser.get(userId);
    if (!set) {
      set = new Set<StreamClient>();
      this.clientsByUser.set(userId, set);
    }
    set.add(client);

    return () => {
      const currentSet = this.clientsByUser.get(userId);
      if (!currentSet) return;
      currentSet.delete(client);
      if (currentSet.size === 0) {
        this.clientsByUser.delete(userId);
      }
    };
  }

  /**
   * Push a "notification" event to every active connection owned by the user.
   * Delivery failures are swallowed: real-time push is best-effort and must
   * never break the business transaction that triggered it.
   */
  notify(userId: number, payload: unknown = { type: 'refresh' }): void {
    const set = this.clientsByUser.get(userId);
    if (!set || set.size === 0) return;
    for (const client of set) {
      this.write(client.res, 'notification', payload);
    }
  }

  /** Send an SSE comment line to keep the connection and any proxies warm. */
  sendHeartbeat(res: Response): void {
    try {
      res.write(': ping\n\n');
      this.flush(res);
    } catch (error) {
      logger.debug('Failed to send SSE heartbeat', { error });
    }
  }

  private write(res: Response, event: string, data: unknown): void {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      this.flush(res);
    } catch (error) {
      logger.warn('Failed to write SSE event', { error });
    }
  }

  private flush(res: Response): void {
    // `compression` middleware exposes a flush() helper on the response; when
    // compression is skipped for the event-stream this is absent, so guard it.
    const flushable = res as unknown as { flush?: () => void };
    if (typeof flushable.flush === 'function') {
      flushable.flush();
    }
  }
}

export const notificationStreamHub = new NotificationStreamHub();
export default notificationStreamHub;
