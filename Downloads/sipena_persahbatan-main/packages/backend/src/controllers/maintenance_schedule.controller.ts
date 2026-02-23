import { Request, Response } from 'express';
import * as scheduleService from '../services/maintenance_schedule.service';

export const createSchedule = async (req: Request, res: Response) => {
  try {
    const schedule = await scheduleService.createSchedule(req.body);
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ message: 'Gagal menambah jadwal pemeliharaan', error });
  }
};

export const getAllSchedules = async (_req: Request, res: Response) => {
  try {
    const schedules = await scheduleService.getAllSchedules();
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data jadwal', error });
  }
};

export const getScheduleById = async (req: Request, res: Response) => {
  try {
    const schedule = await scheduleService.getScheduleById(Number(req.params.id));
    if (!schedule) return res.status(404).json({ message: 'Jadwal tidak ditemukan' });
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data jadwal', error });
  }
};

export const updateSchedule = async (req: Request, res: Response) => {
  try {
    const updated = await scheduleService.updateSchedule(Number(req.params.id), req.body);
    res.json({ message: 'Jadwal diperbarui', updated });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui jadwal', error });
  }
};

export const deleteSchedule = async (req: Request, res: Response) => {
  try {
    await scheduleService.deleteSchedule(Number(req.params.id));
    res.json({ message: 'Jadwal dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus jadwal', error });
  }
};
