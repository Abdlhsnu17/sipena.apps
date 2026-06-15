import { AssetType } from './asset.model';

export interface Maintenance {
  id: number;
  maintenanceCode: string;
  assetId: number;
  assetType?: AssetType;
  assetName?: string;
  assetCode?: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  assetLocation?: string;
  requesterName?: string;
  requesterNip?: string;
  validatorName?: string;
  validatorNip?: string;
  scheduleId?: number;
  type: MaintenanceType;
  status: MaintenanceStatus;
  scheduledDate: Date | string;
  completedDate?: Date;
  description: string;
  technician?: string;
  cost?: number;
  notes?: string;
  cancellationReason?: string;
  createdBy: number;
  completedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  deletedBy?: number;
  deleteReason?: string;
}

export type MaintenanceType = 'preventive' | 'corrective' | 'calibration' | 'inspection';

export type MaintenanceStatus =
  | 'requested'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'validated'
  | 'cancelled';

export type MaintenanceView = 'active' | 'history';

export interface CreateMaintenanceDTO {
  assetId: number;
  assetType?: AssetType;
  type: MaintenanceType;
  status?: MaintenanceStatus;
  scheduledDate: Date | string;
  description?: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  technician?: string;
  cost?: number;
  notes?: string;
  cancellationReason?: string;
  createdBy: number;
  scheduleId?: number;
}

export interface UpdateMaintenanceDTO {
  assetId?: number;
  assetType?: AssetType;
  status?: MaintenanceStatus;
  type?: MaintenanceType;
  scheduledDate?: Date | string;
  description?: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  technician?: string;
  cost?: number;
  notes?: string;
  cancellationReason?: string;
}

export interface CompleteMaintenanceDTO {
  notes?: string;
  cost?: number;
  completedBy: number;
}

export interface MaintenanceFilters {
  page: number;
  limit: number;
  status?: string;
  view?: MaintenanceView;
  assetId?: string;
  assetType?: AssetType;
  type?: string;
  actorUserId?: number | string | null;
  actorRole?: string | null;
}
