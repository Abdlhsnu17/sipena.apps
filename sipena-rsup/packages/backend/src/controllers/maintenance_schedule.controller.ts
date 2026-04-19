import { Request, Response } from 'express';
import * as scheduleService from '../services/maintenance_schedule.service';
import { recordUserActivity } from '../services/user_activity.service';
import { hasAnyRole } from '../utils/role';

const getActorUserId = (req: Request): number | null => {
  const parsed = Number(req.user?.id);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const createSchedule = async (req: Request, res: Response) => {
  try {
    // Only admin, leader, staff, staff_pj can create schedules
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    if (!hasAnyRole(req.user.role, ['admin', 'leader', 'staff', 'staff_pj'])) {
      res.status(403).json({ success: false, message: 'Teknisi tidak dapat membuat jadwal pemeliharaan baru' });
      return;
    }
    const schedule = await scheduleService.createSchedule({
      ...req.body,
      createdBy: req.user.id,
    });
    const actorId = getActorUserId(req);
    if (actorId) {
      await recordUserActivity({
        userId: actorId,
        feature: 'jadwal_pemeliharaan',
        action: 'create',
        description: `Menambahkan jadwal pemeliharaan #${schedule?.id ?? '-'}`,
        metadata: {
          transactionId: schedule?.id,
          transaction_id: schedule?.id,
          scheduleId: schedule?.id,
          assetId: schedule?.asset_id,
          status: schedule?.status,
        },
      });
    }
    res.status(201).json({ success: true, data: schedule });
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
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const actorId = getActorUserId(req);

    // Teknisi can only update status, not other fields
    if (hasAnyRole(req.user.role, ['teknisi'])) {
      // Extract only status from request body
      const { status } = req.body;
      if (!status) {
        res.status(400).json({ 
          success: false, 
          message: 'Teknisi hanya dapat mengubah status jadwal' 
        });
        return;
      }
      const updated = await scheduleService.updateScheduleStatus(
        Number(req.params.id),
        status,
        req.user.role,
        actorId
      );
      if (actorId) {
        await recordUserActivity({
          userId: actorId,
          feature: 'jadwal_pemeliharaan',
          action: 'status_update',
          description: `Memperbarui status jadwal #${req.params.id} menjadi ${status}`,
          metadata: {
            transactionId: Number(req.params.id),
            transaction_id: Number(req.params.id),
            scheduleId: Number(req.params.id),
            status,
          },
        });
      }
      res.json({ success: true, message: 'Status jadwal diperbarui', data: updated });
      return;
    }

    // Admin, leader, staff, staff_pj can update all fields
    const updated = await scheduleService.updateSchedule(Number(req.params.id), {
      ...req.body,
      updatedBy: actorId,
    });
    if (actorId) {
      await recordUserActivity({
        userId: actorId,
        feature: 'jadwal_pemeliharaan',
        action: 'update',
        description: `Mengubah jadwal pemeliharaan #${req.params.id}`,
        metadata: {
          transactionId: Number(req.params.id),
          transaction_id: Number(req.params.id),
          scheduleId: Number(req.params.id),
          status: updated?.status,
        },
      });
    }
    res.json({ success: true, message: 'Jadwal diperbarui', data: updated });
  } catch (error: any) {
    res.status(400).json({ 
      success: false,
      message: error.message || 'Gagal memperbarui jadwal', 
      error 
    });
  }
};

export const updateScheduleStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const actorId = getActorUserId(req);

    // Only teknisi, admin, and leader can update status via this endpoint
    if (!hasAnyRole(req.user.role, ['admin', 'leader', 'teknisi'])) {
      res.status(403).json({ 
        success: false, 
        message: 'Anda tidak memiliki akses untuk mengubah status jadwal' 
      });
      return;
    }

    const { status } = req.body;
    if (!status) {
      res.status(400).json({ 
        success: false, 
        message: 'Status harus disediakan' 
      });
      return;
    }

    const updated = await scheduleService.updateScheduleStatus(
      Number(req.params.id),
      status,
      req.user.role,
      actorId
    );
    if (actorId) {
      await recordUserActivity({
        userId: actorId,
        feature: 'jadwal_pemeliharaan',
        action: 'status_update',
        description: `Mengubah status jadwal #${req.params.id} menjadi ${status}`,
        metadata: {
          transactionId: Number(req.params.id),
          transaction_id: Number(req.params.id),
          scheduleId: Number(req.params.id),
          status,
        },
      });
    }
    res.json({ 
      success: true, 
      message: `Status jadwal berhasil diubah menjadi: ${status}`, 
      data: updated 
    });
  } catch (error: any) {
    res.status(400).json({ 
      success: false,
      message: error.message || 'Gagal mengubah status jadwal', 
      error 
    });
  }
};

export const deleteSchedule = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    // Only admin and leader can delete schedules
    if (!hasAnyRole(req.user.role, ['admin', 'leader'])) {
      res.status(403).json({ success: false, message: 'Hanya admin atau leader yang dapat menghapus jadwal' });
      return;
    }
    const actorId = getActorUserId(req);
    const deleted = await scheduleService.deleteSchedule(Number(req.params.id));
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Jadwal tidak ditemukan' });
      return;
    }
    if (actorId) {
      await recordUserActivity({
        userId: actorId,
        feature: 'jadwal_pemeliharaan',
        action: 'delete',
        description: `Menghapus jadwal pemeliharaan #${req.params.id}`,
        metadata: {
          transactionId: Number(req.params.id),
          transaction_id: Number(req.params.id),
          scheduleId: Number(req.params.id),
        },
      });
    }
    res.json({ success: true, message: 'Jadwal dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus jadwal', error });
  }
};
