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
  /** Terisi untuk notifikasi hasil siaran admin yang menyertakan gambar. */
  imagePath?: string | null;
}

/** Satu siaran admin; disebar menjadi banyak baris `notifications`. */
export interface Announcement {
  id: number;
  title: string;
  message: string;
  imagePath?: string | null;
  createdBy?: number | null;
  createdByName?: string | null;
  createdAt?: Date | string;
  /** Jumlah penerima saat siaran dikirim. */
  recipients: number;
  /** Berapa penerima yang sudah membacanya. */
  readCount: number;
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
