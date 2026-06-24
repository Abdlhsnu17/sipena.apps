import { MaintenanceStatus, MaintenanceType } from './maintenance.model';

export interface MaintenanceHistory {
  id: number;
  maintenanceId: number;
  assetId: number;
  type: MaintenanceType;
  status: MaintenanceStatus;
  scheduledDate: Date | string;
  startedDate?: Date | string;
  completedDate?: Date | string;
  description: string;
  technician?: string;
  cost?: number;
  notes?: string;
  createdBy?: number;
  validatedBy?: number;
  validatedAt?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string;
  deletedBy?: number;
  deleteReason?: string;
  requesterName?: string;
  requesterNip?: string;
  requesterWorkUnit?: string;
  requesterSubWorkUnit?: string;
  validatorName?: string;
  validatorNip?: string;
}

export interface CreateMaintenanceHistoryDTO {
  maintenanceId: number;
  assetId: number;
  type: MaintenanceType;
  status: MaintenanceStatus;
  scheduledDate: Date | string;
  startedDate?: Date | string;
  completedDate?: Date | string;
  description: string;
  technician?: string;
  cost?: number;
  notes?: string;
  createdBy: number;
}

export interface ValidateMaintenanceHistoryDTO {
  validatedBy: number;
  validatedAt: Date | string;
}
