import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ApiResponse } from '../models';
import { CreateNotificationDTO, Notification, NotificationCategory } from '../models/notification.model';
import { createScopedLogger } from '../utils/logger';
import { notificationStreamHub } from '../utils/notification-stream';

const logger = createScopedLogger('service:notification');

interface NotificationRow extends RowDataPacket {
  id: number;
  user_id: number;
  type: string;
  category: NotificationCategory;
  title: string;
  message: string | null;
  link: string | null;
  reference_type: string | null;
  reference_id: number | null;
  is_read: number;
  read_at: Date | null;
  created_at: Date;
}

const mapRow = (row: NotificationRow): Notification => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  category: row.category,
  title: row.title,
  message: row.message ?? undefined,
  link: row.link ?? undefined,
  referenceType: row.reference_type ?? undefined,
  referenceId: row.reference_id ?? undefined,
  isRead: Boolean(row.is_read),
  readAt: row.read_at ?? undefined,
  createdAt: row.created_at,
});

export class NotificationService {
  /**
   * Persist a single notification. Never throws: notification delivery must not
   * break the primary business transaction that triggered it.
   */
  async create(dto: CreateNotificationDTO): Promise<Notification | null> {
    try {
      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO notifications
           (user_id, type, category, title, message, link, reference_type, reference_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dto.userId,
          dto.type,
          dto.category ?? 'system',
          dto.title,
          dto.message ?? null,
          dto.link ?? null,
          dto.referenceType ?? null,
          dto.referenceId ?? null,
        ]
      );

      const notification: Notification = {
        id: result.insertId,
        userId: dto.userId,
        type: dto.type,
        category: dto.category ?? 'system',
        title: dto.title,
        message: dto.message,
        link: dto.link,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        isRead: false,
        createdAt: new Date(),
      };

      // Best-effort real-time push; never blocks or throws.
      notificationStreamHub.notify(dto.userId, notification);

      return notification;
    } catch (error) {
      logger.error('Failed to create notification', { error, userId: dto.userId, type: dto.type });
      return null;
    }
  }

  /**
   * Persist the same notification for multiple recipients (e.g. all admins).
   */
  async createForUsers(userIds: number[], dto: Omit<CreateNotificationDTO, 'userId'>): Promise<void> {
    const uniqueIds = Array.from(new Set(userIds.filter((id) => Number.isFinite(id) && id > 0)));
    if (uniqueIds.length === 0) return;

    try {
      const values = uniqueIds.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const params: unknown[] = [];
      for (const userId of uniqueIds) {
        params.push(
          userId,
          dto.type,
          dto.category ?? 'system',
          dto.title,
          dto.message ?? null,
          dto.link ?? null,
          dto.referenceType ?? null,
          dto.referenceId ?? null
        );
      }

      await pool.query<ResultSetHeader>(
        `INSERT INTO notifications
           (user_id, type, category, title, message, link, reference_type, reference_id)
         VALUES ${values}`,
        params
      );

      // Best-effort real-time push for every recipient.
      for (const userId of uniqueIds) {
        notificationStreamHub.notify(userId);
      }
    } catch (error) {
      logger.error('Failed to create notifications for users', { error, count: uniqueIds.length, type: dto.type });
    }
  }

  async getForUser(
    userId: number,
    filters: { unreadOnly?: boolean; category?: string; page?: number; limit?: number }
  ): Promise<ApiResponse<{ data: Notification[]; total: number; unreadCount: number }>> {
    try {
      const page = filters.page ?? 1;
      const limit = filters.limit ?? 20;
      const offset = (page - 1) * limit;

      const conditions: string[] = ['user_id = ?'];
      const params: unknown[] = [userId];

      if (filters.unreadOnly) {
        conditions.push('is_read = 0');
      }
      if (filters.category) {
        conditions.push('category = ?');
        params.push(filters.category);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;

      const [[countRow]] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM notifications ${where}`,
        params
      );
      const [[unreadRow]] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS unreadCount FROM notifications WHERE user_id = ? AND is_read = 0`,
        [userId]
      );
      const [rows] = await pool.query<NotificationRow[]>(
        `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return {
        success: true,
        message: 'Notifikasi berhasil diambil',
        data: {
          data: rows.map(mapRow),
          total: Number(countRow.total ?? 0),
          unreadCount: Number(unreadRow.unreadCount ?? 0),
        },
      };
    } catch (error) {
      logger.error('Failed to fetch notifications', { error, userId });
      return { success: false, message: 'Gagal mengambil notifikasi' };
    }
  }

  async getUnreadCount(userId: number): Promise<ApiResponse<{ unreadCount: number }>> {
    try {
      const [[row]] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS unreadCount FROM notifications WHERE user_id = ? AND is_read = 0`,
        [userId]
      );
      return {
        success: true,
        message: 'Jumlah notifikasi belum dibaca',
        data: { unreadCount: Number(row.unreadCount ?? 0) },
      };
    } catch (error) {
      logger.error('Failed to fetch unread count', { error, userId });
      return { success: false, message: 'Gagal mengambil jumlah notifikasi' };
    }
  }

  async markAsRead(userId: number, id: number): Promise<ApiResponse> {
    try {
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE notifications SET is_read = 1, read_at = NOW()
         WHERE id = ? AND user_id = ? AND is_read = 0`,
        [id, userId]
      );
      if (result.affectedRows === 0) {
        const [[exists]] = await pool.query<RowDataPacket[]>(
          `SELECT id FROM notifications WHERE id = ? AND user_id = ? LIMIT 1`,
          [id, userId]
        );
        if (!exists) {
          return { success: false, message: 'Notifikasi tidak ditemukan' };
        }
      }
      return { success: true, message: 'Notifikasi ditandai sudah dibaca' };
    } catch (error) {
      logger.error('Failed to mark notification as read', { error, userId, id });
      return { success: false, message: 'Gagal memperbarui notifikasi' };
    }
  }

  async markAllAsRead(userId: number): Promise<ApiResponse<{ updated: number }>> {
    try {
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE notifications SET is_read = 1, read_at = NOW()
         WHERE user_id = ? AND is_read = 0`,
        [userId]
      );
      return {
        success: true,
        message: 'Semua notifikasi ditandai sudah dibaca',
        data: { updated: result.affectedRows },
      };
    } catch (error) {
      logger.error('Failed to mark all notifications as read', { error, userId });
      return { success: false, message: 'Gagal memperbarui notifikasi' };
    }
  }

  async remove(userId: number, id: number): Promise<ApiResponse> {
    try {
      const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
        [id, userId]
      );
      if (result.affectedRows === 0) {
        return { success: false, message: 'Notifikasi tidak ditemukan' };
      }
      return { success: true, message: 'Notifikasi dihapus' };
    } catch (error) {
      logger.error('Failed to delete notification', { error, userId, id });
      return { success: false, message: 'Gagal menghapus notifikasi' };
    }
  }
}

export default new NotificationService();
