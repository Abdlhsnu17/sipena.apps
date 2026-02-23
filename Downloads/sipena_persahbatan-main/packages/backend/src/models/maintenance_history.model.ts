import { MaintenanceStatus, MaintenanceType } from './maintenance.model';

export interface MaintenanceHistory {
  id: number;
  maintenanceId: number;
  assetId: number;
  type: MaintenanceType;
  status: MaintenanceStatus;
  scheduledDate: Date;
  startedDate?: Date;
  completedDate?: Date;
  description: string;
  technician?: string;
  cost?: number;
  notes?: string;
  createdBy: number;
  validatedBy?: number;
  validatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateMaintenanceHistoryDTO {
  maintenanceId: number;
  assetId: number;
  type: MaintenanceType;
  status: MaintenanceStatus;
  scheduledDate: Date;
  startedDate?: Date;
  completedDate?: Date;
  description: string;
  technician?: string;
  cost?: number;
  notes?: string;
  createdBy: number;
}

export interface ValidateMaintenanceHistoryDTO {
  validatedBy: number;
  validatedAt: Date;
}
