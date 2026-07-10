import apiService from './api.service'

export type MaintenanceScheduleStatus = 'terjadwal' | 'proses' | 'tertunda' | 'selesai' | 'dibatalkan'
export interface MaintenanceSchedule { id: number; asset_id: number; asset_type: 'medical' | 'non_medical'; tanggal: string; deskripsi?: string | null; status: MaintenanceScheduleStatus }

export const maintenanceScheduleService = {
  list: () => apiService.get<MaintenanceSchedule[]>('/maintenance-schedule'),
  create: (data: Pick<MaintenanceSchedule, 'asset_id' | 'asset_type' | 'tanggal'> & { deskripsi?: string }) => apiService.post<{ success: boolean; data: MaintenanceSchedule }>('/maintenance-schedule', data),
  updateStatus: (id: number, status: MaintenanceScheduleStatus) => apiService.patch<{ success: boolean; data: MaintenanceSchedule }>(`/maintenance-schedule/${id}/status`, { status }),
}
