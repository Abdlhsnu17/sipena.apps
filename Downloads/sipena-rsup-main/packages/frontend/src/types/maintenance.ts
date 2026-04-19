// Maintenance types
export interface Maintenance {
  id: number;
  maintenanceCode: string;
  assetId: number;
  assetName?: string;
  assetCode?: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  scheduledDate: string;
  completedDate?: string;
  validatedAt?: string;
  description: string;
  technician?: string;
  cost?: number;
  notes?: string;
  cancellationReason?: string;
  createdBy: number;
  completedBy?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type MaintenanceType = 'preventive' | 'corrective' | 'calibration' | 'inspection';

export type MaintenanceStatus =
  | 'requested'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'validated'
  | 'cancelled';

// Maintenance filters
export interface MaintenanceFilters {
  page?: number;
  limit?: number;
  status?: MaintenanceStatus;
  assetId?: number | string;
  type?: MaintenanceType;
  startDate?: string;
  endDate?: string;
}

// Maintenance form data
export interface MaintenanceFormData {
  assetId: number;
  type: MaintenanceType;
  scheduledDate: string;
  description: string;
  technician?: string;
  cost?: number;
  notes?: string;
  cancellationReason?: string;
}

// Maintenance response
export interface MaintenanceResponse {
  success: boolean;
  message: string;
  data: Maintenance | Maintenance[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
