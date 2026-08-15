export * from './app-setting.model';
export * from './asset.model';
export * from './asset-disposal.model';
export * from './asset-usage.model';
export * from './borrowing.model';
export * from './deletion-request.model';
export * from './dss.model';
export * from './maintenance.model';
export * from './maintenance-history.model';
export * from './notification.model';
export * from './user.model';
export * from './user-activity.model';

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
