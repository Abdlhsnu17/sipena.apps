export interface CompleteMaintenanceHistoryDTO {
  notes?: string;
  status?: string;
  completedDate?: Date;
  technician?: string;
  cost?: number;
}

export const complete = async (id: number, data: CompleteMaintenanceHistoryDTO): Promise<MaintenanceHistory | undefined> => {
  const history = maintenanceHistories.find(h => h.id === id);
  if (history) {
    // Jika status masih requested, ubah ke in_progress saat service mulai mengisi
    if (history.status === 'requested') {
      history.status = 'in_progress';
      history.startedDate = new Date();
    }
    // Jika service mengisi status completed, update status dan tanggal selesai
    if (data.status === 'completed') {
      history.status = 'completed';
      history.completedDate = data.completedDate ? new Date(data.completedDate) : new Date();
    }
    if (data.notes !== undefined) history.notes = data.notes;
    if (data.technician !== undefined) history.technician = data.technician;
    if (data.cost !== undefined) history.cost = data.cost;
    history.updatedAt = new Date();
  }
  return history;
};
import { CreateMaintenanceHistoryDTO, MaintenanceHistory } from '../models/maintenance_history.model';

let maintenanceHistories: MaintenanceHistory[] = [];
let idCounter = 1;

export const getAll = async (): Promise<MaintenanceHistory[]> => {
  return maintenanceHistories;
};

export const getById = async (id: number): Promise<MaintenanceHistory | undefined> => {
  return maintenanceHistories.find(h => h.id === id);
};

export const create = async (data: CreateMaintenanceHistoryDTO): Promise<MaintenanceHistory> => {
  const newHistory: MaintenanceHistory = {
    ...data,
    id: idCounter++,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: data.status,
  };
  maintenanceHistories.push(newHistory);
  return newHistory;
};

export const validate = async (id: number, validatedBy: number, validatedAt: Date): Promise<MaintenanceHistory | undefined> => {
  const history = maintenanceHistories.find(h => h.id === id);
  if (history) {
    history.validatedBy = validatedBy;
    history.validatedAt = validatedAt;
    // Jika status completed, ubah ke validated
    if (history.status === 'completed') {
      history.status = 'validated';
    }
    history.updatedAt = new Date();
  }
  return history;
};

export const remove = async (id: number): Promise<void> => {
  maintenanceHistories = maintenanceHistories.filter(h => h.id !== id);
};
