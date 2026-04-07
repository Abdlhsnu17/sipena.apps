export type UserActivityFeature =
  | 'unggahan'
  | 'jadwal_pemeliharaan'
  | 'pemeliharaan'
  | 'peminjaman_alat'
  | 'pengembalian_alat';

export interface UserActivity {
  id: number;
  userId: number;
  feature: UserActivityFeature | string;
  action: string;
  description: string;
  metadata?: Record<string, any> | null;
  createdAt: Date | string;
}

export interface CreateUserActivityDTO {
  userId: number;
  feature: UserActivityFeature | string;
  action: string;
  description: string;
  metadata?: Record<string, any> | null;
}

