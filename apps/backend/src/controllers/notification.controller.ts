import { Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import notificationService from '../services/notification.service';
import { notificationStreamHub } from '../utils/notification-stream';
import { createSseTicket } from '../utils/sse-ticket';

const getActorUserId = (req: Request): number | null => {
  const parsed = Number(req.user?.id);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const SSE_HEARTBEAT_INTERVAL_MS = 25000;

const isValidWebhookUrl = (value: string | undefined): boolean => {
  if (!value?.trim()) return false;

  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

class NotificationController {
  createStreamTicket = async (req: Request, res: Response): Promise<void> => {
    const actorId = getActorUserId(req);
    if (!actorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    try {
      const data = await createSseTicket(actorId);
      res.status(201).json({ success: true, data });
    } catch {
      res.status(503).json({ success: false, message: 'Layanan notifikasi real-time belum tersedia' });
    }
  };

  getDeliveryStatus = async (_req: Request, res: Response): Promise<void> => {
    const isProduction = (process.env.NODE_ENV || 'development') === 'production';
    const hasWhatsapp = isValidWebhookUrl(
      process.env.WHATSAPP_NOTIFICATION_WEBHOOK_URL || process.env.WHATSAPP_OTP_WEBHOOK_URL
    );
    const hasSms = isValidWebhookUrl(
      process.env.SMS_NOTIFICATION_WEBHOOK_URL || process.env.SMS_OTP_WEBHOOK_URL
    );
    const hasEmail = Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
    res.json({ success: true, data: {
      inApp: true,
      whatsapp: { configured: hasWhatsapp, mode: hasWhatsapp ? 'active' : isProduction ? 'unavailable' : 'preview' },
      sms: { configured: hasSms, mode: hasSms ? 'active' : isProduction ? 'unavailable' : 'preview' },
      email: { configured: hasEmail, mode: hasEmail ? 'active' : isProduction ? 'unavailable' : 'preview' },
    }});
  };

  getMine = async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, message: 'Validasi gagal', errors: errors.array() });
      return;
    }

    const actorId = getActorUserId(req);
    if (!actorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const result = await notificationService.getForUser(actorId, {
      unreadOnly: req.query.unreadOnly === 'true',
      category: req.query.category as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.status(result.success ? 200 : 400).json(result);
  };

  getUnreadCount = async (req: Request, res: Response): Promise<void> => {
    const actorId = getActorUserId(req);
    if (!actorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const result = await notificationService.getUnreadCount(actorId);
    res.status(result.success ? 200 : 400).json(result);
  };

  markAsRead = async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, message: 'Validasi gagal', errors: errors.array() });
      return;
    }

    const actorId = getActorUserId(req);
    if (!actorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const result = await notificationService.markAsRead(actorId, Number(req.params.id));
    res.status(result.success ? 200 : 404).json(result);
  };

  markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    const actorId = getActorUserId(req);
    if (!actorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const result = await notificationService.markAllAsRead(actorId);
    res.status(result.success ? 200 : 400).json(result);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, message: 'Validasi gagal', errors: errors.array() });
      return;
    }

    const actorId = getActorUserId(req);
    if (!actorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const result = await notificationService.remove(actorId, Number(req.params.id));
    res.status(result.success ? 200 : 404).json(result);
  };

  /**
   * Server-Sent Events stream that pushes real-time notification signals to the
   * authenticated user. Authentication is handled by a short-lived, one-use ticket.
   */
  stream = (req: Request, res: Response): void => {
    const actorId = req.streamUserId || null;
    if (!actorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable proxy buffering (e.g. nginx) so events are delivered immediately.
      'X-Accel-Buffering': 'no',
    });
    // Tell the browser how long to wait before reconnecting on a dropped stream.
    res.write('retry: 10000\n\n');

    const removeClient = notificationStreamHub.addClient(actorId, res);
    const heartbeat = setInterval(() => {
      notificationStreamHub.sendHeartbeat(res);
    }, SSE_HEARTBEAT_INTERVAL_MS);

    const cleanup = (): void => {
      clearInterval(heartbeat);
      removeClient();
    };

    req.on('close', cleanup);
    res.on('error', cleanup);
  };
}

export const notificationValidators = {
  getMine: [
    query('unreadOnly').optional().isIn(['true', 'false']),
    query('category')
      .optional()
      .isIn(['borrowing', 'maintenance', 'disposal', 'deletion', 'asset', 'system']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  id: [param('id').isInt({ min: 1 })],
};

export default new NotificationController();
