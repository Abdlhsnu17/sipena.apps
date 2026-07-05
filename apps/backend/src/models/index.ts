export * from './asset.model';
export * from './asset_disposal.model';
export * from './asset_usage.model';
export * from './borrowing.model';
export * from './deletion_request.model';
export * from './maintenance.model';
export * from './maintenance_history.model';
export * from './maintenance_schedule.model';
export * from './notification.model';
export * from './user.model';
export * from './user_activity.model';

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
