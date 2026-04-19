import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { AssetType } from '../models';
import { MaintenanceStatus, MaintenanceType } from '../models/maintenance.model';
import { CreateMaintenanceHistoryDTO, MaintenanceHistory } from '../models/maintenance_history.model';
import { AssetService } from './asset.service';

export interface CompleteMaintenanceHistoryDTO {
  notes?: string;
  status?: string;
  completedDate?: Date | string;
  technician?: string;
  cost?: number;
}

interface MaintenanceHistoryRow extends RowDataPacket {
  id: number;
  maintenance_id: number;
  asset_id: number;
  type: string;
  status: string;
  scheduled_date: Date;
  started_date: Date | null;
  completed_date: Date | null;
  description: string;
  technician: string | null;
  cost: number | null;
  notes: string | null;
  created_by: number | null;
  validated_by: number | null;
  validated_at: Date | null;
  created_at: Date;
  updated_at: Date;
  requester_name?: string;
  requester_nip?: string;
  validator_name?: string;
  validator_nip?: string;
}

interface MaintenanceAssetContext {
  assetId: number;
  assetType: AssetType;
}

const ACTIVE_MAINTENANCE_STATUSES: MaintenanceStatus[] = ['scheduled', 'in_progress', 'completed'];
const RELEASABLE_MAINTENANCE_STATUSES: MaintenanceStatus[] = ['validated', 'cancelled'];

const SELECT_WITH_USERS = `
  SELECT
    mh.*,
    creator.name AS requester_name,
    creator.nip AS requester_nip,
    validator.name AS validator_name,
    validator.nip AS validator_nip
  FROM maintenance_history mh
  LEFT JOIN users creator ON mh.created_by = creator.id
  LEFT JOIN users validator ON mh.validated_by = validator.id
`;

const formatDateTimeForMySQL = (value: Date): string => {
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
};

const formatDateTimeAsLocalIso = (value: Date): string => {
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
};

const parseLocalDateTime = (raw: string): Date | null => {
  const normalized = raw.replace(/\s+/g, 'T');
  const localMatch = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/
  );

  if (!localMatch) return null;

  const [, year, month, day, hour, minute, second = '0'] = localMatch;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toSqlDateTime = (value?: Date | string | null): string | null => {
  if (value === undefined || value === null) return null;

  let parsed: Date;
  if (value instanceof Date) {
    parsed = value;
  } else {
    const raw = String(value).trim();
    if (!raw) return null;

    const localParsed = parseLocalDateTime(raw);
    if (localParsed) {
      parsed = localParsed;
    } else {
      const normalized = raw.replace(/\s+/g, 'T');
      parsed = new Date(normalized);
    }
  }

  if (Number.isNaN(parsed.getTime())) return null;
  return formatDateTimeForMySQL(parsed);
};

const normalizeAssetType = (value?: string | null): AssetType => (value === 'non_medical' ? 'non_medical' : 'medical');

const toIsoString = (value?: Date | string | null): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return formatDateTimeAsLocalIso(value);

  const raw = String(value).trim();
  if (!raw) return undefined;

  const localParsed = parseLocalDateTime(raw);
  if (localParsed) {
    return formatDateTimeAsLocalIso(localParsed);
  }

  const normalized = raw.replace(/\s+/g, 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return formatDateTimeAsLocalIso(parsed);
};

const mapRowToHistory = (row: MaintenanceHistoryRow): MaintenanceHistory => ({
  id: row.id,
  maintenanceId: row.maintenance_id,
  assetId: row.asset_id,
  type: row.type as MaintenanceType,
  status: row.status as MaintenanceStatus,
  scheduledDate: toIsoString(row.scheduled_date) ?? '',
  startedDate: toIsoString(row.started_date),
  completedDate: toIsoString(row.completed_date),
  description: row.description,
  technician: row.technician ?? undefined,
  cost: row.cost ?? undefined,
  notes: row.notes ?? undefined,
  createdBy: row.created_by ?? undefined,
  validatedBy: row.validated_by ?? undefined,
  validatedAt: toIsoString(row.validated_at),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
  requesterName: row.requester_name ?? undefined,
  requesterNip: row.requester_nip ?? undefined,
  validatorName: row.validator_name ?? undefined,
  validatorNip: row.validator_nip ?? undefined,
});

const assetService = new AssetService();

const resolveMaintenanceAssetContext = async (
  maintenanceId: number,
  fallbackAssetId: number
): Promise<MaintenanceAssetContext | null> => {
  const [maintenanceRows] = await pool.query<RowDataPacket[]>(
    `SELECT asset_id, COALESCE(asset_type, 'medical') AS asset_type
     FROM maintenance_records
     WHERE id = ?
     LIMIT 1`,
    [maintenanceId]
  );

  if (maintenanceRows.length > 0) {
    const assetId = Number(maintenanceRows[0].asset_id ?? fallbackAssetId);
    if (Number.isFinite(assetId) && assetId > 0) {
      return {
        assetId,
        assetType: normalizeAssetType(String(maintenanceRows[0].asset_type || 'medical'))
      };
    }
  }

  const medicalAsset = await assetService.getById(String(fallbackAssetId), 'medical');
  if (medicalAsset.success && medicalAsset.data) {
    return { assetId: fallbackAssetId, assetType: 'medical' };
  }

  const nonMedicalAsset = await assetService.getById(String(fallbackAssetId), 'non_medical');
  if (nonMedicalAsset.success && nonMedicalAsset.data) {
    return { assetId: fallbackAssetId, assetType: 'non_medical' };
  }

  return null;
};

const hasOtherActiveMaintenance = async (
  assetId: number,
  assetType: AssetType,
  excludeMaintenanceId?: number
): Promise<boolean> => {
  const params: any[] = [assetId, assetType, ...ACTIVE_MAINTENANCE_STATUSES];
  let query = `
    SELECT COUNT(*) as count
    FROM maintenance_records
    WHERE asset_id = ?
      AND COALESCE(asset_type, 'medical') = ?
      AND status IN (?, ?, ?)
  `;

  if (excludeMaintenanceId !== undefined) {
    query += ' AND id <> ?';
    params.push(excludeMaintenanceId);
  }

  const [rows] = await pool.query<RowDataPacket[]>(query, params);
  return Number((rows[0] as any)?.count || 0) > 0;
};

const parseAssetSpecifications = (raw: unknown): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  if (typeof raw === 'object') {
    return raw as Record<string, any>;
  }

  return {};
};

const normalizeDetailIdentifier = (value?: string | number | null): string => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const matchesAssetDetail = (
  detail: Record<string, any>,
  detailId?: string | null,
  detailCode?: string | null
): boolean => {
  const normalizedTargetId = normalizeDetailIdentifier(detailId);
  const normalizedTargetCode = normalizeDetailIdentifier(detailCode);
  const detailCandidates = [
    normalizeDetailIdentifier(detail.id),
    normalizeDetailIdentifier(detail.detailId),
    normalizeDetailIdentifier(detail.assetDetailId),
    normalizeDetailIdentifier(detail.assetCode),
    normalizeDetailIdentifier(detail.detailCode),
    normalizeDetailIdentifier(detail.serialNumber)
  ].filter(Boolean);

  if (normalizedTargetId && detailCandidates.includes(normalizedTargetId)) {
    return true;
  }

  if (normalizedTargetCode && detailCandidates.includes(normalizedTargetCode)) {
    return true;
  }

  return false;
};

const syncAssetDetailStatus = async (
  context: MaintenanceAssetContext,
  maintenanceId: number,
  maintenanceStatus: MaintenanceStatus
): Promise<void> => {
  if (
    !ACTIVE_MAINTENANCE_STATUSES.includes(maintenanceStatus) &&
    !RELEASABLE_MAINTENANCE_STATUSES.includes(maintenanceStatus)
  ) {
    return;
  }

  const [maintenanceRows] = await pool.query<RowDataPacket[]>(
    `SELECT asset_detail_id, asset_detail_code
     FROM maintenance_records
     WHERE id = ?
     LIMIT 1`,
    [maintenanceId]
  );

  const detailId = normalizeDetailIdentifier(maintenanceRows[0]?.asset_detail_id);
  const detailCode = normalizeDetailIdentifier(maintenanceRows[0]?.asset_detail_code);
  const shouldMatchSpecificDetail = Boolean(detailId || detailCode);

  const assetResponse = await assetService.getById(String(context.assetId), context.assetType);
  if (!assetResponse.success || !assetResponse.data) return;

  const specifications = parseAssetSpecifications(assetResponse.data.specifications);
  const details = Array.isArray(specifications.details) ? specifications.details : [];
  if (details.length === 0) return;

  const nextDetailStatus = ACTIVE_MAINTENANCE_STATUSES.includes(maintenanceStatus)
    ? 'Dalam Perbaikan'
    : 'Aktif';

  let hasChanges = false;
  const updatedDetails = details.map((rawDetail: any) => {
    const detail = rawDetail && typeof rawDetail === 'object' ? { ...rawDetail } : rawDetail;
    if (!detail || typeof detail !== 'object') return rawDetail;

    const isTarget = shouldMatchSpecificDetail
      ? matchesAssetDetail(detail, detailId, detailCode)
      : true;

    if (!isTarget) return rawDetail;

    if (detail.status !== nextDetailStatus) {
      detail.status = nextDetailStatus;
      hasChanges = true;
    }

    return detail;
  });

  if (!hasChanges) return;

  await assetService.update(
    String(context.assetId),
    {
      specifications: {
        ...specifications,
        details: updatedDetails
      }
    },
    context.assetType
  );
};

const syncAssetAvailability = async (
  maintenanceId: number,
  maintenanceStatus: MaintenanceStatus,
  fallbackAssetId: number
): Promise<void> => {
  const context = await resolveMaintenanceAssetContext(maintenanceId, fallbackAssetId);
  if (!context) return;

  if (ACTIVE_MAINTENANCE_STATUSES.includes(maintenanceStatus)) {
    await assetService.updateStatus(String(context.assetId), 'maintenance', context.assetType);
    await syncAssetDetailStatus(context, maintenanceId, maintenanceStatus);
    return;
  }

  if (!RELEASABLE_MAINTENANCE_STATUSES.includes(maintenanceStatus)) {
    return;
  }

  const stillHasActiveMaintenance = await hasOtherActiveMaintenance(
    context.assetId,
    context.assetType,
    maintenanceId
  );

  if (!stillHasActiveMaintenance) {
    await assetService.updateStatus(String(context.assetId), 'available', context.assetType);
  }

  await syncAssetDetailStatus(context, maintenanceId, maintenanceStatus);
};

const getRawById = async (id: number): Promise<MaintenanceHistoryRow | null> => {
  const [rows] = await pool.query<MaintenanceHistoryRow[]>(`SELECT * FROM maintenance_history WHERE id = ?`, [id]);
  return rows.length ? rows[0] : null;
};

const getRawByMaintenanceId = async (maintenanceId: number): Promise<MaintenanceHistoryRow | null> => {
  const [rows] = await pool.query<MaintenanceHistoryRow[]>(
    `SELECT * FROM maintenance_history WHERE maintenance_id = ? ORDER BY id DESC LIMIT 1`,
    [maintenanceId]
  );
  return rows.length ? rows[0] : null;
};

const getHistoryById = async (id: number): Promise<MaintenanceHistory | undefined> => {
  const [rows] = await pool.query<MaintenanceHistoryRow[]>(`${SELECT_WITH_USERS} WHERE mh.id = ?`, [id]);
  if (rows.length === 0) return undefined;
  return mapRowToHistory(rows[0]);
};

const getHistoryByMaintenanceId = async (maintenanceId: number): Promise<MaintenanceHistory | undefined> => {
  const [rows] = await pool.query<MaintenanceHistoryRow[]>(
    `${SELECT_WITH_USERS} WHERE mh.maintenance_id = ? ORDER BY mh.id DESC LIMIT 1`,
    [maintenanceId]
  );
  if (rows.length === 0) return undefined;
  return mapRowToHistory(rows[0]);
};

export const getAll = async (): Promise<MaintenanceHistory[]> => {
  const [rows] = await pool.query<MaintenanceHistoryRow[]>(`${SELECT_WITH_USERS} ORDER BY mh.created_at DESC`);
  return rows.map(mapRowToHistory);
};

export const getById = async (id: number): Promise<MaintenanceHistory | undefined> => {
  return getHistoryById(id);
};

export const getByMaintenanceId = async (maintenanceId: number): Promise<MaintenanceHistory | undefined> => {
  return getHistoryByMaintenanceId(maintenanceId);
};

export const create = async (data: CreateMaintenanceHistoryDTO): Promise<MaintenanceHistory> => {
  const scheduledDate = toSqlDateTime(data.scheduledDate);
  if (!scheduledDate) {
    throw new Error('Scheduled date tidak valid');
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO maintenance_history (
       maintenance_id,
       asset_id,
       type,
       status,
       scheduled_date,
       description,
       technician,
       cost,
       notes,
       created_by,
       created_at,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      data.maintenanceId,
      data.assetId,
      data.type,
      data.status || 'requested',
      scheduledDate,
      data.description || '',
      data.technician || null,
      data.cost ?? null,
      data.notes || null,
      data.createdBy ?? null,
    ]
  );

  const history = await getHistoryById(result.insertId);
  if (!history) {
    throw new Error('Gagal mengambil riwayat setelah penyimpanan');
  }

  if (history.status) {
    await syncAssetAvailability(history.maintenanceId, history.status, history.assetId);
  }

  return history;
};

export const complete = async (id: number, data: CompleteMaintenanceHistoryDTO): Promise<MaintenanceHistory | undefined> => {
  const existing = await getRawById(id);
  if (!existing) return undefined;

  const updates: string[] = [];
  const params: any[] = [];

  let nextStatus = existing.status;
  if (existing.status === 'requested') {
    nextStatus = 'in_progress';
  }
  if (data.status) {
    nextStatus = data.status;
  }

  if (nextStatus !== existing.status) {
    updates.push('status = ?');
    params.push(nextStatus);
  }

  if (nextStatus === 'in_progress' && !existing.started_date) {
    updates.push('started_date = ?');
    params.push(toSqlDateTime(new Date()));
  }

  if (existing.status === 'completed' && nextStatus === 'in_progress') {
    updates.push('completed_date = ?');
    params.push(null);
  }

  if (data.notes !== undefined) {
    updates.push('notes = ?');
    params.push(data.notes || null);
  }

  if (data.technician !== undefined) {
    updates.push('technician = ?');
    params.push(data.technician || null);
  }

  if (data.cost !== undefined) {
    updates.push('cost = ?');
    params.push(Number.isNaN(Number(data.cost)) ? null : data.cost);
  }

  const shouldSetCompleted = nextStatus === 'completed';
  const completedDateValue = data.completedDate ? toSqlDateTime(data.completedDate) : toSqlDateTime(new Date());
  if (shouldSetCompleted && completedDateValue) {
    updates.push('completed_date = ?');
    params.push(completedDateValue);
  } else if (data.completedDate) {
    const parsed = toSqlDateTime(data.completedDate);
    if (parsed) {
      updates.push('completed_date = ?');
      params.push(parsed);
    }
  }

  if (updates.length === 0) {
    return getHistoryById(id);
  }

  const query = `UPDATE maintenance_history SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`;
  await pool.query(query, [...params, id]);

  const updated = await getHistoryById(id);
  if (updated?.status) {
    await syncAssetAvailability(updated.maintenanceId, updated.status as MaintenanceStatus, updated.assetId);
  }

  return updated;
};

export const completeByMaintenanceId = async (
  maintenanceId: number,
  data: CompleteMaintenanceHistoryDTO
): Promise<MaintenanceHistory | undefined> => {
  const existing = await getRawByMaintenanceId(maintenanceId);
  if (!existing) return undefined;
  return complete(existing.id, data);
};

export const validate = async (id: number, validatedBy: number, validatedAt: Date | string): Promise<MaintenanceHistory | undefined> => {
  const existing = await getRawById(id);
  if (!existing) return undefined;

  if (existing.status !== 'completed' && existing.status !== 'validated') {
    throw new Error('Validasi riwayat hanya dapat dilakukan setelah perbaikan selesai');
  }

  const parsedValidatedAt = toSqlDateTime(validatedAt) || toSqlDateTime(new Date());
  const updates = ['validated_by = ?', 'validated_at = ?'];
  const params: any[] = [validatedBy, parsedValidatedAt];

  if (existing.status === 'completed') {
    updates.push('status = ?');
    params.push('validated');
  }

  const query = `UPDATE maintenance_history SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`;
  await pool.query(query, [...params, id]);

  const updated = await getHistoryById(id);
  if (updated?.status) {
    await syncAssetAvailability(updated.maintenanceId, updated.status as MaintenanceStatus, updated.assetId);
  }

  return updated;
};

export const validateByMaintenanceId = async (
  maintenanceId: number,
  validatedBy: number,
  validatedAt: Date | string
): Promise<MaintenanceHistory | undefined> => {
  const existing = await getRawByMaintenanceId(maintenanceId);
  if (!existing) return undefined;
  return validate(existing.id, validatedBy, validatedAt);
};

export const remove = async (id: number): Promise<void> => {
  await pool.query('DELETE FROM maintenance_history WHERE id = ?', [id]);
};
