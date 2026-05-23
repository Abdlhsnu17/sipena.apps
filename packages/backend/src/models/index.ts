export * from './asset.model';
export * from './asset_usage.model';
export * from './borrowing.model';
export * from './maintenance.model';
export * from './user_activity.model';
export * from './user.model';

// Common response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
