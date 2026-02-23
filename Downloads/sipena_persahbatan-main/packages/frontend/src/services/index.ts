export { apiService, default } from './api.service';
export { assetService } from './asset.service';
export { authService } from './auth.service';
export { borrowingService } from './borrowing.service';
export { maintenanceService } from './maintenance.service';

// Re-export types
export type { Asset, AssetFilters, AssetResponse, SingleAssetResponse } from './asset.service';
export type { AuthResponse, LoginCredentials, RegisterCredentials, User } from './auth.service';
export type { Borrowing, BorrowingFilters, BorrowingResponse, CreateBorrowingData, SingleBorrowingResponse } from './borrowing.service';
export type { CreateMaintenanceData, Maintenance, MaintenanceFilters, MaintenanceResponse, SingleMaintenanceResponse } from './maintenance.service';

