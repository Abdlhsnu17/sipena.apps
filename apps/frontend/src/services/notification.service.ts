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
export interface NotificationDeliveryStatus {
  inApp: boolean;
  whatsapp: { configured: boolean; mode: 'active' | 'preview' | 'unavailable' };
  sms: { configured: boolean; mode: 'active' | 'preview' | 'unavailable' };
  email: { configured: boolean; mode: 'active' | 'preview' | 'unavailable' };
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
