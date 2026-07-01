// Common/shared types
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
  pagination: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface TableColumn<T = any> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfig {
  [key: string]: string | number | boolean | undefined;
}

// Dashboard types
export interface DashboardStats {
  totalAssets: number;
  totalMedicalAssets: number;
  totalNonMedicalAssets: number;
  availableAssets: number;
  borrowedAssets: number;
  maintenanceAssets: number;
  totalBorrowings: number;
  pendingBorrowings: number;
  activeBorrowings: number;
  overdueBorrowings: number;
  activeSanctions: number;
  totalMaintenance: number;
  scheduledMaintenance: number;
  totalUsers: number;
}

// Navigation types
export interface NavItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
  requiredRole?: string[];
}
