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

class NotificationService {
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

  /**
   * Open a Server-Sent Events stream for real-time notifications. EventSource
   * cannot send an Authorization header, so the JWT is passed as a query param.
   * Returns null when running on the server or when EventSource is unavailable.
   */
  createEventSource(token: string): EventSource | null {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined' || !token) {
      return null;
    }
    const url = `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`;
    try {
      return new EventSource(url);
    } catch {
      return null;
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
