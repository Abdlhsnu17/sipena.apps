export type NotificationCategory =
  | 'borrowing'
  | 'maintenance'
  | 'disposal'
  | 'deletion'
  | 'asset'
  | 'system';

export interface Notification {
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
  readAt?: Date | string;
  createdAt?: Date | string;
}

export interface CreateNotificationDTO {
  userId: number;
  type: string;
  category?: NotificationCategory;
  title: string;
  message?: string;
  link?: string;
  referenceType?: string;
  referenceId?: number;
}
