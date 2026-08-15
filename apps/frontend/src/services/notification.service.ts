import apiService, { API_BASE_URL } from './api.service';

export type NotificationCategory =
  | 'borrowing'
  | 'maintenance'
  | 'disposal'
  | 'deletion'
  | 'asset'
  | 'system';

export interface AppNotification {
  id: number;
  userId: number;
  type: string;
  category: NotificationCategory;
  title: string;
  message?: string;
  link?: string;
  referenceType?: string;
  referenceId?: number;
  isRead: boolean;
  readAt?: string;
  createdAt?: string;
  /** Relatif terhadap root uploads, mis. `announcements/abc.png`. */
  imagePath?: string | null;
}

export interface BroadcastHistoryItem {
  id: number;
  title: string;
  message: string;
  link?: string | null;
  imagePath?: string | null;
  createdByName?: string | null;
  createdAt?: string;
  recipients: number;
  readCount: number;
}

export interface NotificationListResponse {
  success: boolean;
  message: string;
  data: {
    data: AppNotification[];
    total: number;
    unreadCount: number;
  };
}

export interface UnreadCountResponse {
  success: boolean;
  message: string;
  data: { unreadCount: number };
}
export interface NotificationDeliveryStatus {
  inApp: boolean;
  whatsapp: { configured: boolean; mode: 'active' | 'preview' | 'unavailable' };
  sms: { configured: boolean; mode: 'active' | 'preview' | 'unavailable' };
  email: { configured: boolean; mode: 'active' | 'preview' | 'unavailable' };
}

/** Sinkron dengan batas di `notification.controller.ts`. */
export const BROADCAST_TITLE_MAX_LENGTH = 150;
export const BROADCAST_MESSAGE_MAX_LENGTH = 1000;
export const BROADCAST_LINK_MAX_LENGTH = 500;
/** Sinkron dengan batas multer di `notification.routes.ts`. */
export const BROADCAST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

class NotificationService {
  /** Khusus admin: mengirim satu pemberitahuan ke seluruh pengguna aktif. */
  async broadcast(payload: { title: string; message: string; link?: string; image?: File | null }) {
    // Selalu multipart supaya satu endpoint melayani kiriman dengan maupun
    // tanpa gambar.
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('message', payload.message);
    if (payload.link) formData.append('link', payload.link);
    if (payload.image) formData.append('image', payload.image);

    return apiService.post<{
      success: boolean;
      message: string;
      data?: { announcementId: number; recipients: number };
    }>('/notifications/broadcast', formData);
  }

  /** Khusus admin: riwayat siaran beserta jumlah penerima dan pembacanya. */
  async getBroadcastHistory(limit = 5) {
    return apiService.get<{
      success: boolean;
      message: string;
      data?: BroadcastHistoryItem[];
    }>(`/notifications/broadcasts?limit=${limit}`);
  }

  async list(params: {
    unreadOnly?: boolean;
    category?: NotificationCategory;
    page?: number;
    limit?: number;
  } = {}) {
    const q = new URLSearchParams();
    if (params.unreadOnly) q.set('unreadOnly', 'true');
    if (params.category) q.set('category', params.category);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return apiService.get<NotificationListResponse>(`/notifications${suffix}`);
  }

  async getUnreadCount() {
    return apiService.get<UnreadCountResponse>('/notifications/unread-count');
  }
  async getDeliveryStatus() {
    return apiService.get<{ success: boolean; data: NotificationDeliveryStatus }>('/notifications/delivery-status');
  }

  async markAsRead(id: number) {
    return apiService.patch<{ success: boolean; message: string }>(`/notifications/${id}/read`, {});
  }

  async markAllAsRead() {
    return apiService.patch<{ success: boolean; message: string; data: { updated: number } }>(
      '/notifications/read-all',
      {}
    );
  }

  async remove(id: number) {
    return apiService.delete<{ success: boolean; message: string }>(`/notifications/${id}`);
  }

  async createEventSource(): Promise<EventSource | null> {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return null;
    }

    try {
      const response = await apiService.post<{
        success: boolean;
        data: { ticket: string; expiresIn: number };
      }>('/notifications/stream-ticket', {});
      const url = `${API_BASE_URL}/notifications/stream?ticket=${encodeURIComponent(response.data.ticket)}`;
      return new EventSource(url);
    } catch {
      return null;
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
