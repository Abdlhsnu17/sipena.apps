import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { AssetType, MaintenanceStatus, MaintenanceType } from '../models';

interface MaintenanceScheduleRow extends RowDataPacket {
  id: number;
  asset_id: number;
  asset_type: string;
  tanggal: string;
  deskripsi?: string | null;
  status: string;
  created_at?: Date;
  updated_at?: Date;
}

// Define allowed status values for maintenance schedule
const ALLOWED_STATUSES = ['terjadwal', 'proses', 'tertunda', 'selesai', 'dibatalkan'];
const TEKNISI_EDITABLE_STATUSES = ['proses', 'tertunda', 'selesai', 'dibatalkan'];

const validateStatus = (status: string): boolean => {
  return ALLOWED_STATUSES.includes(status.toLowerCase());
};

const normalizeAssetType = (value?: string | null): AssetType | undefined => {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!normalized) return undefined;
  if (['medical', 'medis'].includes(normalized)) return 'medical';
  if (['non_medical', 'non-medis', 'non_medis', 'nonmedis', 'non-medis', 'non_medis'].includes(normalized)) {
    return 'non_medical';
  }
  return undefined;
};

const mapScheduleStatusToMaintenanceStatus = (status?: string | null): MaintenanceStatus => {
  const normalized = String(status || '').toLowerCase();
  switch (normalized) {
    case 'proses':
      return 'in_progress';
    case 'selesai':
      return 'completed';
    case 'dibatalkan':
      return 'cancelled';
    case 'tertunda':
    case 'terjadwal':
    default:
      return 'scheduled';
  }
};

const mapScheduleTypeToMaintenanceType = (value?: string | null): MaintenanceType => {
  const normalized = String(value || '').toLowerCase();
  switch (normalized) {
    case 'corrective':
    case 'calibration':
    case 'inspection':
    case 'preventive':
      return normalized;
    default:
      return 'preventive';
  }
};

const syncMaintenanceRecordBySchedule = async (
  scheduleId: number,
  scheduleStatus: string,
  actorUserId?: number | null
) => {
  const [maintenanceRows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM maintenance_records WHERE schedule_id = ? ORDER BY id DESC LIMIT 1',
    [scheduleId]
  );

  if (!maintenanceRows.length) return;

  const maintenanceId = String(maintenanceRows[0].id);
  const mappedStatus = mapScheduleStatusToMaintenanceStatus(scheduleStatus);
  const { MaintenanceService } = await import('./maintenance.service.js');
  const maintenanceService = new MaintenanceService();

  const updatePayload: Record<string, any> = {
    status: mappedStatus
  };

  if (mappedStatus === 'completed' && actorUserId && actorUserId > 0) {
    updatePayload.completedBy = actorUserId;
  }

  await maintenanceService.update(maintenanceId, updatePayload);
};

export const createSchedule = async (data: any) => {

  const assetId = data.asset_id ?? data.assetId;
  const assetType = normalizeAssetType(data.assetType ?? data.asset_type);
  const scheduleStatus = data.status || 'terjadwal';
  const maintenanceStatus = mapScheduleStatusToMaintenanceStatus(scheduleStatus);
  if (!assetId || !data.tanggal) {
    throw new Error('asset_id and tanggal are required');
  }

  // Insert ke jadwal pemeliharaan
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO jadwal_pemeliharaan (asset_id, asset_type, tanggal, deskripsi, status)
     VALUES (?, ?, ?, ?, ?)`,
    [assetId, assetType || 'medical', data.tanggal, data.deskripsi || null, scheduleStatus]
  );

  const [rows] = await pool.query<MaintenanceScheduleRow[]>(
    'SELECT * FROM jadwal_pemeliharaan WHERE id = ?',
    [result.insertId]
  );

  // Insert ke histori pemeliharaan (maintenance_records) dengan schedule_id
  try {
    const { MaintenanceService } = await import('./maintenance.service.js');
    const maintenanceService = new MaintenanceService();
    const maintenanceResult = await maintenanceService.create({
      assetId: assetId,
      assetType,
      type: mapScheduleTypeToMaintenanceType(data.type),
      status: maintenanceStatus,
      scheduledDate: data.tanggal,
      description: data.deskripsi || '',
      createdBy: data.createdBy || null,
      scheduleId: result.insertId
    });

    if (!maintenanceResult.success) {
      await pool.query<ResultSetHeader>('DELETE FROM jadwal_pemeliharaan WHERE id = ?', [result.insertId]);
      throw new Error(maintenanceResult.message || 'Gagal sinkronisasi data pemeliharaan');
    }
  } catch (err) {
    throw err;
  }

  return rows[0];
};

export const getAllSchedules = async () => {
  const [rows] = await pool.query<MaintenanceScheduleRow[]>(
    'SELECT * FROM jadwal_pemeliharaan ORDER BY created_at DESC'
  );
  return rows;
};

export const getScheduleById = async (id: number) => {
  const [rows] = await pool.query<MaintenanceScheduleRow[]>(
    'SELECT * FROM jadwal_pemeliharaan WHERE id = ?',
    [id]
  );
  return rows[0] || null;
};

export const updateSchedule = async (id: number, data: any) => {
  const updates: string[] = [];
  const values: any[] = [];

  if (data.asset_id !== undefined || data.assetId !== undefined) {
    updates.push('asset_id = ?');
    values.push(data.asset_id ?? data.assetId);
  }
  if (data.tanggal !== undefined) {
    updates.push('tanggal = ?');
    values.push(data.tanggal);
  }
  if (data.deskripsi !== undefined) {
    updates.push('deskripsi = ?');
    values.push(data.deskripsi);
  }
  if (data.status !== undefined) {
    // Validate status
    const statusLower = data.status.toLowerCase();
    if (!validateStatus(statusLower)) {
      throw new Error(`Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(', ')}`);
    }
    updates.push('status = ?');
    values.push(statusLower);
  }
  if (data.assetType !== undefined || data.asset_type !== undefined) {
    updates.push('asset_type = ?');
    values.push(data.assetType ?? data.asset_type);
  }

  if (updates.length === 0) {
    return getScheduleById(id);
  }

  updates.push('updated_at = NOW()');
  values.push(id);

  await pool.query<ResultSetHeader>(
    `UPDATE jadwal_pemeliharaan SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  const updatedSchedule = await getScheduleById(id);
  if (updatedSchedule?.status) {
    await syncMaintenanceRecordBySchedule(id, updatedSchedule.status, data.updatedBy || data.updated_by || null);
  }

  return updatedSchedule;
};

export const deleteSchedule = async (id: number) => {
  const [result] = await pool.query<ResultSetHeader>(
    'DELETE FROM jadwal_pemeliharaan WHERE id = ?',
    [id]
  );
  return result.affectedRows > 0;
};

// Teknisi-specific status update function
export const updateScheduleStatus = async (
  id: number,
  status: string,
  _userRole: string,
  actorUserId?: number | null
) => {
  const statusLower = status.toLowerCase();
  
  // Validate status
  if (!TEKNISI_EDITABLE_STATUSES.includes(statusLower)) {
    throw new Error(`Status tidak valid. Status yang diizinkan untuk teknisi: ${TEKNISI_EDITABLE_STATUSES.join(', ')}`);
  }

  // Check if schedule exists
  const schedule = await getScheduleById(id);
  if (!schedule) {
    throw new Error('Jadwal pemeliharaan tidak ditemukan');
  }

  // Update status
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE jadwal_pemeliharaan SET status = ?, updated_at = NOW() WHERE id = ?`,
    [statusLower, id]
  );

  if (result.affectedRows === 0) {
    throw new Error('Gagal memperbarui status jadwal');
  }

  await syncMaintenanceRecordBySchedule(id, statusLower, actorUserId);

  return getScheduleById(id);
};

export { ALLOWED_STATUSES, TEKNISI_EDITABLE_STATUSES, validateStatus };
