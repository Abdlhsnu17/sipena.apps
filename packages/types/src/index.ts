export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data?: T;
};

export type PaginatedResponse<T = unknown> = ApiResponse<T[]> & {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ActivityMetadata = Record<string, unknown>;

export type UserActivityFeature =
  | 'unggahan'
  | 'jadwal_pemeliharaan'
  | 'pemeliharaan'
  | 'peminjaman_alat'
  | 'pengembalian_alat'
  | 'pencarian';

export interface UserActivity {
  id: number;
  userId: number;
  userName?: string | null;
  userNip?: string | null;
  feature: UserActivityFeature | string;
  action: string;
  description: string;
  metadata?: ActivityMetadata | null;
  createdAt: Date | string;
}

export interface CreateUserActivityDTO {
  userId: number;
  feature: UserActivityFeature | string;
  action: string;
  description: string;
  metadata?: ActivityMetadata | null;
}
