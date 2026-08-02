import { Request, Response } from 'express';
import * as MaintenanceHistoryService from '../services/maintenance-history.service';
import { CompleteMaintenanceHistoryDTO } from '../services/maintenance-history.service';
export const completeMaintenanceHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data: CompleteMaintenanceHistoryDTO = req.body;
    const updated = await MaintenanceHistoryService.complete(Number(id), data);
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: (error as Error).message || 'Gagal memperbarui riwayat pemeliharaan'
    });
  }
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
  try {
    const data = req.body;
    const created = await MaintenanceHistoryService.create(data);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: (error as Error).message || 'Gagal membuat riwayat pemeliharaan'
    });
  }
};

export const validateMaintenanceHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { validatedBy, validatedAt } = req.body;
    const updated = await MaintenanceHistoryService.validate(Number(id), validatedBy, validatedAt);
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: (error as Error).message || 'Gagal memvalidasi riwayat pemeliharaan'
    });
  }
};

export const deleteMaintenanceHistory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const deleteReason = typeof req.body?.deleteReason === 'string' ? req.body.deleteReason.trim() : undefined;
  if (!deleteReason) {
    res.status(400).json({ success: false, message: 'Alasan penghapusan wajib diisi' });
    return;
  }

  const deleted = await MaintenanceHistoryService.remove(
    Number(id),
    req.user?.id ? Number(req.user.id) : undefined,
    deleteReason
  );

  if (!deleted) {
    res.status(404).json({ success: false, message: 'Riwayat pemeliharaan tidak ditemukan' });
    return;
  }

  res.json({ success: true, message: 'Riwayat pemeliharaan diarsipkan' });
};
