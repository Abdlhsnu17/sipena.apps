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
  type: 'preventive' | 'corrective' | 'calibration' | 'inspection';
  status: 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'validated' | 'cancelled';
  scheduledDate: string;
  completedDate?: string;
  validatedAt?: string;
  description: string;
  technician?: string;
  cost?: number;
  notes?: string;
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
  status?: string;
  assetId?: string;
  assetType?: 'medical' | 'non_medical';
  type?: string;
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
    type: maintenance.type,
    status: maintenance.status,
    scheduledDate: normalizedScheduledDate,
    completedDate: maintenance.completedDate ?? maintenance.completed_date,
    description: maintenance.description,
    technician: maintenance.technician,
    cost: maintenance.cost,
    notes: maintenance.notes,
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
  status?: 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'validated' | 'cancelled';
  scheduledDate: string;
  description?: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  assetLocation?: string;
  technician?: string;
  cost?: number;
  notes?: string;
  createdBy: number;
}

export interface UpdateMaintenanceData {
  assetId?: number;
  assetType?: 'medical' | 'non_medical';
  type?: 'preventive' | 'corrective' | 'calibration' | 'inspection';
  scheduledDate?: string;
  description?: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  assetLocation?: string;
  technician?: string;
  cost?: number;
  notes?: string;
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

class MaintenanceService {
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
    return mapSingleMaintenance(response);
  }

  async update(id: number | string, data: UpdateMaintenanceData): Promise<SingleMaintenanceResponse> {
    const response = await apiService.put<SingleMaintenanceResponse>(`/maintenance/${id}`, data);
    return mapSingleMaintenance(response);
  }

  async complete(id: number | string, notes?: string, cost?: number, completedBy?: number): Promise<SingleMaintenanceResponse> {
    const response = await apiService.patch<SingleMaintenanceResponse>(`/maintenance/${id}/complete`, { notes, cost, completedBy });
    return mapSingleMaintenance(response);
  }

  async delete(id: number | string): Promise<{ success: boolean; message: string }> {
    return apiService.delete(`/maintenance/${id}`);
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
