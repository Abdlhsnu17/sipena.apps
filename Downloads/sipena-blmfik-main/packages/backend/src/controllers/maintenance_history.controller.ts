import { Request, Response } from 'express';
import * as MaintenanceHistoryService from '../services/maintenance_history.service';
import { CompleteMaintenanceHistoryDTO } from '../services/maintenance_history.service';
export const completeMaintenanceHistory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const data: CompleteMaintenanceHistoryDTO = req.body;
  const updated = await MaintenanceHistoryService.complete(Number(id), data);
  if (!updated) return res.status(404).json({ message: 'Not found' });
  res.json(updated);
};

export const getAllMaintenanceHistory = async (req: Request, res: Response) => {
  const histories = await MaintenanceHistoryService.getAll();
  res.json(histories);
};

export const getMaintenanceHistoryById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const history = await MaintenanceHistoryService.getById(Number(id));
  if (!history) return res.status(404).json({ message: 'Not found' });
  res.json(history);
};

export const createMaintenanceHistory = async (req: Request, res: Response) => {
  const data = req.body;
  const created = await MaintenanceHistoryService.create(data);
  res.status(201).json(created);
};

export const validateMaintenanceHistory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { validatedBy, validatedAt } = req.body;
  const updated = await MaintenanceHistoryService.validate(Number(id), validatedBy, validatedAt);
  res.json(updated);
};

export const deleteMaintenanceHistory = async (req: Request, res: Response) => {
  const { id } = req.params;
  await MaintenanceHistoryService.remove(Number(id));
  res.status(204).send();
};
