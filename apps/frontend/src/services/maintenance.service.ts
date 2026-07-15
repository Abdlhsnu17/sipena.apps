import { toLocalDateTimeString } from '@/utils/format';
import apiService from './api.service';

export interface Maintenance {
  id: number;
  maintenanceCode: string;
  assetId: number;
  assetType?: 'medical' | 'non_medical';
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
  type: 'preventive' | 'corrective' | 'calibration' | 'inspection';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  status: 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'validated' | 'cancelled';
  scheduledDate: string;
  dueAt?: string;
  startedAt?: string;
  completedDate?: string;
  validatedAt?: string;
  description: string;
  technician?: string;
  technicianUserId?: number;
  technicianNip?: string;
  technicianRole?: string;
  technicianWorkUnit?: string;
  vendorName?: string;
  vendorReference?: string;
  warrantyUntil?: string;
  cost?: number;
  notes?: string;
  cancellationReason?: string;
  slaStatus?: 'no_target' | 'on_track' | 'at_risk' | 'overdue' | 'met' | 'met_late';
  slaRemainingMinutes?: number;
  slaLateMinutes?: number;
  createdBy: number;
  completedBy?: number;
  validatorName?: string;
  validatorNip?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MaintenanceFilters {
  page?: number;
  limit?: number;
  view?: 'active' | 'history';
  status?: string;
  assetId?: string;
  assetType?: 'medical' | 'non_medical';
  type?: string;
  automationSource?: 'usage_threshold' | 'manual';
}

export interface MaintenanceResponse {
  success: boolean;
  message: string;
  data: Maintenance[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SingleMaintenanceResponse {
  success: boolean;
  message: string;
  data?: Maintenance;
}

export interface MaintenanceTechnicianCandidate {
  id: number;
  nip: string;
  name: string;
  role: string;
  workUnit: string | null;
  subWorkUnit?: string | null;
}

export interface MaintenanceTechnicianCandidatesResponse {
  success: boolean;
  message: string;
  data: MaintenanceTechnicianCandidate[];
}

const normalizeMaintenance = (maintenance: any): Maintenance => {
  const normalizedScheduledDate = toLocalDateTimeString(
    maintenance.scheduledDate ?? maintenance.scheduled_date
  ) ?? "";

  return {
    id: maintenance.id,
    maintenanceCode: maintenance.maintenanceCode ?? maintenance.maintenance_code,
    assetId: maintenance.assetId ?? maintenance.asset_id,
    assetType: maintenance.assetType ?? maintenance.asset_type,
    assetName: maintenance.assetName ?? maintenance.asset_name,
    assetCode: maintenance.assetCode ?? maintenance.asset_code,
    assetDetailId: maintenance.assetDetailId ?? maintenance.asset_detail_id,
    assetDetailName: maintenance.assetDetailName ?? maintenance.asset_detail_name,
    assetDetailCode: maintenance.assetDetailCode ?? maintenance.asset_detail_code,
    assetLocation: maintenance.assetLocation ?? maintenance.asset_location,
    requesterName: maintenance.requesterName ?? maintenance.requester_name,
    requesterNip: maintenance.requesterNip ?? maintenance.requester_nip,
    requesterWorkUnit: maintenance.requesterWorkUnit ?? maintenance.requester_work_unit,
    requesterSubWorkUnit: maintenance.requesterSubWorkUnit ?? maintenance.requester_sub_work_unit,
    type: maintenance.type,
    priority: maintenance.priority ?? 'normal',
    status: maintenance.status,
    scheduledDate: normalizedScheduledDate,
    dueAt: maintenance.dueAt ?? maintenance.due_at,
    startedAt: maintenance.startedAt ?? maintenance.started_at,
    completedDate: maintenance.completedDate ?? maintenance.completed_date,
    description: maintenance.description,
    technician: maintenance.technician,
    technicianUserId: maintenance.technicianUserId ?? maintenance.technician_user_id,
    technicianNip: maintenance.technicianNip ?? maintenance.technician_nip,
    technicianRole: maintenance.technicianRole ?? maintenance.technician_role,
    technicianWorkUnit: maintenance.technicianWorkUnit ?? maintenance.technician_work_unit,
    vendorName: maintenance.vendorName ?? maintenance.vendor_name,
    vendorReference: maintenance.vendorReference ?? maintenance.vendor_reference,
    warrantyUntil: maintenance.warrantyUntil ?? maintenance.warranty_until,
    cost: maintenance.cost,
    notes: maintenance.notes,
    cancellationReason: maintenance.cancellationReason ?? maintenance.cancellation_reason,
    slaStatus: maintenance.slaStatus ?? maintenance.sla_status,
    slaRemainingMinutes: maintenance.slaRemainingMinutes ?? maintenance.sla_remaining_minutes,
    slaLateMinutes: maintenance.slaLateMinutes ?? maintenance.sla_late_minutes,
    createdBy: maintenance.createdBy ?? maintenance.created_by,
    completedBy: maintenance.completedBy ?? maintenance.completed_by,
    validatorName: maintenance.validatorName ?? maintenance.validator_name,
    validatorNip: maintenance.validatorNip ?? maintenance.validator_nip,
    createdAt: maintenance.createdAt ?? maintenance.created_at,
    validatedAt: maintenance.validatedAt ?? maintenance.validated_at,
    updatedAt: maintenance.updatedAt ?? maintenance.updated_at,
  }
};

export interface CreateMaintenanceData {
  assetId: number;
  assetType?: 'medical' | 'non_medical';
  type: 'preventive' | 'corrective' | 'calibration' | 'inspection';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  status?: 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'validated' | 'cancelled';
  scheduledDate: string;
  dueAt?: string;
  description?: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  assetLocation?: string;
  technician?: string;
  technicianUserId?: number;
  vendorName?: string;
  vendorReference?: string;
  warrantyUntil?: string;
  cost?: number;
  notes?: string;
  cancellationReason?: string;
  createdBy: number;
}

export interface UpdateMaintenanceData {
  assetId?: number;
  assetType?: 'medical' | 'non_medical';
  type?: 'preventive' | 'corrective' | 'calibration' | 'inspection';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  scheduledDate?: string;
  dueAt?: string;
  description?: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  assetLocation?: string;
  technician?: string;
  technicianUserId?: number;
  vendorName?: string;
  vendorReference?: string;
  warrantyUntil?: string;
  cost?: number;
  notes?: string;
  cancellationReason?: string;
  status?: 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'validated' | 'cancelled';
}

const mapSingleMaintenance = (response: SingleMaintenanceResponse): SingleMaintenanceResponse => {
  if (!response.data) {
    return response;
  }
  return {
    ...response,
    data: normalizeMaintenance(response.data)
  };
};

const emitNotificationsRefresh = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('notifications-refresh'));
};

class MaintenanceService {
  async getTechnicianCandidates(search = '', limit = 20): Promise<MaintenanceTechnicianCandidatesResponse> {
    const params = new URLSearchParams({ search, limit: String(limit) });
    return apiService.get<MaintenanceTechnicianCandidatesResponse>(`/maintenance/technician-candidates?${params.toString()}`);
  }

  async getAll(filters: MaintenanceFilters = {}): Promise<MaintenanceResponse> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });

    const queryString = params.toString();
    const endpoint = `/maintenance${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiService.get<MaintenanceResponse>(endpoint);
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data.map(normalizeMaintenance) : [],
    };
  }

  async getById(id: number | string): Promise<SingleMaintenanceResponse> {
    const response = await apiService.get<SingleMaintenanceResponse>(`/maintenance/${id}`);
    return mapSingleMaintenance(response);
  }

  async create(data: CreateMaintenanceData): Promise<SingleMaintenanceResponse> {
    const response = await apiService.post<SingleMaintenanceResponse>('/maintenance', data);
    const normalized = mapSingleMaintenance(response);
    if (normalized.success) emitNotificationsRefresh();
    return normalized;
  }

  async update(id: number | string, data: UpdateMaintenanceData): Promise<SingleMaintenanceResponse> {
    const response = await apiService.put<SingleMaintenanceResponse>(`/maintenance/${id}`, data);
    const normalized = mapSingleMaintenance(response);
    if (normalized.success) emitNotificationsRefresh();
    return normalized;
  }

  async complete(id: number | string, notes?: string, cost?: number, completedBy?: number): Promise<SingleMaintenanceResponse> {
    const response = await apiService.patch<SingleMaintenanceResponse>(`/maintenance/${id}/complete`, { notes, cost, completedBy });
    const normalized = mapSingleMaintenance(response);
    if (normalized.success) emitNotificationsRefresh();
    return normalized;
  }

  async delete(id: number | string, deleteReason?: string): Promise<{ success: boolean; message: string }> {
    const response = await apiService.delete<{ success: boolean; message: string }>(`/maintenance/${id}`, { deleteReason });
    if (response.success) emitNotificationsRefresh();
    return response;
  }

  async getScheduledMaintenance(): Promise<MaintenanceResponse> {
    return this.getAll({ status: 'scheduled' });
  }

  async getByAsset(assetId: number | string): Promise<MaintenanceResponse> {
    return this.getAll({ assetId: String(assetId) });
  }
}

export const maintenanceService = new MaintenanceService();
export default maintenanceService;
