import { AssetType } from './asset.model';

export type MaintenanceScheduleStatus =
  | 'terjadwal'
  | 'proses'
  | 'tertunda'
  | 'selesai'
  | 'dibatalkan';

export interface MaintenanceSchedule {
  id: number;
  assetId: number;
  assetType: AssetType;
  tanggal: string;
  deskripsi?: string | null;
  status: MaintenanceScheduleStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateMaintenanceScheduleDTO {
  assetId: number;
  assetType?: AssetType;
  tanggal: string;
  deskripsi?: string;
  status?: MaintenanceScheduleStatus;
  type?: string;
  createdBy?: number;
}

export interface UpdateMaintenanceScheduleDTO {
  assetId?: number;
  assetType?: AssetType;
  tanggal?: string;
  deskripsi?: string;
  status?: MaintenanceScheduleStatus;
  type?: string;
  updatedBy?: number;
}

export const MAINTENANCE_SCHEDULE_STATUSES: MaintenanceScheduleStatus[] = [
  'terjadwal',
  'proses',
  'tertunda',
  'selesai',
  'dibatalkan',
];
