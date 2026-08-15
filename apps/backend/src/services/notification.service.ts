import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ApiResponse } from '../models';
import { Announcement, CreateNotificationDTO, Notification, NotificationCategory } from '../models/notification.model';
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
  announcement_image_path?: string | null;
}

interface AnnouncementRow extends RowDataPacket {
  id: number;
  title: string;
  message: string;
  link: string | null;
  image_path: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: Date;
  recipients: number;
  read_count: number;
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
  imagePath: row.announcement_image_path ?? null,
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
  /**
   * Mengembalikan `false` bila penyimpanan gagal. Pemanggil di alur bisnis boleh
   * mengabaikannya (kegagalan notifikasi tidak boleh menggagalkan transaksi),
   * tetapi aksi yang dipicu admin secara langsung wajib memeriksanya agar tidak
   * melaporkan "terkirim" untuk sesuatu yang sebenarnya gagal.
   */
  async createForUsers(userIds: number[], dto: Omit<CreateNotificationDTO, 'userId'>): Promise<boolean> {
    const uniqueIds = Array.from(new Set(userIds.filter((id) => Number.isFinite(id) && id > 0)));
    if (uniqueIds.length === 0) return false;

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

      return true;
    } catch (error) {
      logger.error('Failed to create notifications for users', { error, count: uniqueIds.length, type: dto.type });
      return false;
    }
  }

  /**
   * Menyiarkan satu pemberitahuan tertulis admin ke seluruh pengguna aktif.
   *
   * Penerimanya sengaja tidak menyaring role: pesan seperti jadwal pemeliharaan
   * berlaku untuk semua orang, termasuk admin pengirimnya sendiri agar isi
   * lonceng pengirim sama dengan yang dilihat penerima lain.
   */
  async broadcast(payload: {
    title: string;
    message: string;
    link?: string | null;
    imagePath?: string | null;
    actorId: number;
  }): Promise<ApiResponse<{ announcementId: number; recipients: number }>> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM users
          WHERE deleted_at IS NULL
            AND COALESCE(account_status, 'active') = 'active'`
      );

      const recipientIds = rows.map((row) => Number(row.id));
      if (recipientIds.length === 0) {
        return { success: false, message: 'Tidak ada pengguna aktif yang bisa dikirimi pemberitahuan' };
      }

      // Isi siaran disimpan sekali di `announcements`; baris notifikasi per
      // penerima hanya menunjuk ke sini lewat reference_type/reference_id.
      const [inserted] = await pool.query<ResultSetHeader>(
        `INSERT INTO announcements (title, message, link, image_path, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [payload.title, payload.message, payload.link ?? null, payload.imagePath ?? null, payload.actorId]
      );
      const announcementId = inserted.insertId;

      const stored = await this.createForUsers(recipientIds, {
        type: 'admin_broadcast',
        category: 'system',
        title: payload.title,
        message: payload.message,
        link: payload.link ?? undefined,
        referenceType: 'announcement',
        referenceId: announcementId,
      });

      if (!stored) {
        // Siaran tanpa penerima tidak ada gunanya dan hanya akan muncul di
        // riwayat seolah-olah terkirim, jadi barisnya dibatalkan.
        await pool.query('DELETE FROM announcements WHERE id = ?', [announcementId]);
        return { success: false, message: 'Pemberitahuan gagal dikirim' };
      }

      logger.info('Admin broadcast sent', {
        actorId: payload.actorId,
        announcementId,
        recipients: recipientIds.length,
        withImage: Boolean(payload.imagePath),
        withLink: Boolean(payload.link),
      });

      return {
        success: true,
        message: `Pemberitahuan terkirim ke ${recipientIds.length} pengguna`,
        data: { announcementId, recipients: recipientIds.length },
      };
    } catch (error) {
      logger.error('Failed to broadcast notification', { error, actorId: payload.actorId });
      return { success: false, message: 'Pemberitahuan gagal dikirim' };
    }
  }

  /** Riwayat siaran beserta berapa penerima yang sudah membacanya. */
  async getBroadcastHistory(limit = 10): Promise<ApiResponse<Announcement[]>> {
    try {
      const [rows] = await pool.query<AnnouncementRow[]>(
        `SELECT a.id, a.title, a.message, a.link, a.image_path, a.created_by, a.created_at,
                u.name AS created_by_name,
                COUNT(n.id) AS recipients,
                COALESCE(SUM(n.is_read), 0) AS read_count
           FROM announcements a
           LEFT JOIN users u ON u.id = a.created_by
           LEFT JOIN notifications n
             ON n.reference_type = 'announcement' AND n.reference_id = a.id
          GROUP BY a.id
          -- id dipakai sebagai pemecah seri: created_at hanya presisi detik,
          -- sehingga dua siaran berurutan bisa tertukar urutannya tanpa ini.
          ORDER BY a.created_at DESC, a.id DESC
          LIMIT ?`,
        [limit]
      );

      return {
        success: true,
        message: 'Riwayat pemberitahuan berhasil diambil',
        data: rows.map((row) => ({
          id: row.id,
          title: row.title,
          message: row.message,
          link: row.link,
          imagePath: row.image_path,
          createdBy: row.created_by,
          createdByName: row.created_by_name,
          createdAt: row.created_at,
          recipients: Number(row.recipients ?? 0),
          readCount: Number(row.read_count ?? 0),
        })),
      };
    } catch (error) {
      logger.error('Failed to fetch broadcast history', { error });
      return { success: false, message: 'Riwayat pemberitahuan gagal diambil' };
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

      const conditions: string[] = ['n.user_id = ?'];
      const params: unknown[] = [userId];

      if (filters.unreadOnly) {
        conditions.push('n.is_read = 0');
      }
      if (filters.category) {
        conditions.push('n.category = ?');
        params.push(filters.category);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;

      const [[countRow]] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM notifications n ${where}`,
        params
      );
      const [[unreadRow]] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS unreadCount FROM notifications WHERE user_id = ? AND is_read = 0`,
        [userId]
      );
      // JOIN ke announcements supaya gambar siaran ikut terbawa tanpa perlu
      // menduplikasi path-nya di setiap baris notifikasi.
      const [rows] = await pool.query<NotificationRow[]>(
        `SELECT n.*, a.image_path AS announcement_image_path
           FROM notifications n
           LEFT JOIN announcements a
             ON n.reference_type = 'announcement' AND n.reference_id = a.id
          ${where}
          ORDER BY n.created_at DESC
          LIMIT ? OFFSET ?`,
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
