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
  requesterWorkUnit?: string;
  requesterSubWorkUnit?: string;
  validatorName?: string;
  validatorNip?: string;
  type: MaintenanceType;
  priority?: MaintenancePriority;
  status: MaintenanceStatus;
  scheduledDate: Date | string;
  dueAt?: Date | string;
  startedAt?: Date | string;
  completedDate?: Date | string;
  actualStartAt?: Date | string;
  actualEndAt?: Date | string;
  description: string;
  technician?: string;
  technicianUserId?: number;
  technicianNip?: string;
  technicianRole?: string;
  technicianWorkUnit?: string;
  vendorName?: string;
  vendorReference?: string;
  warrantyUntil?: Date | string;
  estimatedDurationMinutes?: number;
  estimatedCost?: number;
  damagePhotoUrl?: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  diagnosis?: string;
  actionTaken?: string;
  checklist?: string;
  spareParts?: string;
  verificationResult?: string;
  finalCondition?: string;
  verificationNotes?: string;
  nextMaintenanceDate?: Date | string;
  recurrenceInterval?: MaintenanceRecurrenceInterval;
  recurrenceEnabled?: boolean;
  approvalStatus?: MaintenanceApprovalStatus;
  approvalNotes?: string;
  approvedBy?: number;
  approvedAt?: Date | string;
  reminderH7SentAt?: Date | string;
  reminderH3SentAt?: Date | string;
  reminderH1SentAt?: Date | string;
  cost?: number;
  notes?: string;
  cancellationReason?: string;
  slaStatus?: MaintenanceSlaStatus;
  slaRemainingMinutes?: number;
  slaLateMinutes?: number;
  createdBy: number;
  completedBy?: number;
  validatedBy?: number;
  validatedAt?: Date | string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  deletedBy?: number;
  deleteReason?: string;
}

export type MaintenanceSlaStatus = 'no_target' | 'on_track' | 'at_risk' | 'overdue' | 'met' | 'met_late';

export type MaintenanceType = 'preventive' | 'corrective' | 'calibration' | 'inspection';
export type MaintenancePriority = 'low' | 'normal' | 'high' | 'critical';
export type MaintenanceRecurrenceInterval = 'none' | 'monthly' | 'quarterly' | 'yearly';
export type MaintenanceApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

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
  priority?: MaintenancePriority;
  status?: MaintenanceStatus;
  scheduledDate: Date | string;
  description?: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  technician?: string;
  technicianUserId?: number;
  dueAt?: Date | string;
  startedAt?: Date | string;
  completedDate?: Date | string;
  actualStartAt?: Date | string;
  actualEndAt?: Date | string;
  vendorName?: string;
  vendorReference?: string;
  warrantyUntil?: Date | string;
  estimatedDurationMinutes?: number;
  estimatedCost?: number;
  damagePhotoUrl?: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  diagnosis?: string;
  actionTaken?: string;
  checklist?: string;
  spareParts?: string;
  verificationResult?: string;
  finalCondition?: string;
  verificationNotes?: string;
  nextMaintenanceDate?: Date | string;
  recurrenceInterval?: MaintenanceRecurrenceInterval;
  recurrenceEnabled?: boolean;
  approvalStatus?: MaintenanceApprovalStatus;
  approvalNotes?: string;
  approvedBy?: number;
  approvedAt?: Date | string;
  cost?: number;
  notes?: string;
  cancellationReason?: string;
  createdBy: number;
}

export interface UpdateMaintenanceDTO {
  assetId?: number;
  assetType?: AssetType;
  status?: MaintenanceStatus;
  type?: MaintenanceType;
  priority?: MaintenancePriority;
  scheduledDate?: Date | string;
  description?: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  technician?: string;
  technicianUserId?: number;
  dueAt?: Date | string;
  startedAt?: Date | string;
  completedDate?: Date | string;
  actualStartAt?: Date | string;
  actualEndAt?: Date | string;
  vendorName?: string;
  vendorReference?: string;
  warrantyUntil?: Date | string;
  estimatedDurationMinutes?: number;
  estimatedCost?: number;
  damagePhotoUrl?: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  diagnosis?: string;
  actionTaken?: string;
  checklist?: string;
  spareParts?: string;
  verificationResult?: string;
  finalCondition?: string;
  verificationNotes?: string;
  nextMaintenanceDate?: Date | string;
  recurrenceInterval?: MaintenanceRecurrenceInterval;
  recurrenceEnabled?: boolean;
  approvalStatus?: MaintenanceApprovalStatus;
  approvalNotes?: string;
  approvedBy?: number;
  approvedAt?: Date | string;
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
  automationSource?: 'usage_threshold' | 'manual';
  actorUserId?: number | string | null;
  actorRole?: string | null;
  actorWorkUnit?: string | null;
  /**
   * Kata kunci bebas; dicocokkan ke kode tiket, nama/kode aset, nama detail
   * inventaris, dan pemohon.
   *
   * Catatan: pencarian di browser juga menjangkau merek/model detail inventaris
   * yang tersimpan di dalam JSON `specifications` aset. Itu tidak dapat dicari
   * per-detail di MariaDB 10.4 karena JSON_TABLE belum tersedia, sehingga
   * pencarian sisi server sengaja dibatasi pada kolom nyata.
   */
  search?: string;
}
