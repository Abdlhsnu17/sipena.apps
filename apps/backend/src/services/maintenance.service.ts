import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import {
    ApiResponse,
    Asset,
    AssetType,
    CompleteMaintenanceDTO,
    CreateMaintenanceDTO,
    Maintenance,
    MaintenanceFilters,
    PaginatedResponse,
    UpdateMaintenanceDTO
} from '../models';
import { formatCostLabel, formatDateTimeForMySQL, generateMaintenanceCode } from '../utils/helpers';
import { sendPhoneNotification } from '../utils/notification-delivery';
import { hasAnyRole } from '../utils/role';
import { AssetService } from './asset.service';
import * as MaintenanceHistoryService from './maintenance_history.service';
import notificationService from './notification.service';

interface MaintenanceRow extends RowDataPacket, Maintenance {
  requester_name?: string | null;
  requester_nip?: string | null;
  requester_work_unit?: string | null;
  requester_sub_work_unit?: string | null;
  validator_name?: string | null;
  validator_nip?: string | null;
  technician_nip?: string | null;
  technician_role?: string | null;
  technician_work_unit?: string | null;
}

interface TechnicianAccountRow extends RowDataPacket {
  id: number;
  nip: string;
  name: string;
  role: string;
  work_unit: string | null;
  sub_work_unit: string | null;
}

interface MaintenanceAttachmentRow extends RowDataPacket {
  id: number;
  maintenance_id: number;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  uploaded_by: number | null;
  created_at: Date;
}

export const normalizeComparableText = (value?: string | null): string => {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';
};

export const toLocalIsoDateTime = (value?: string | Date | null): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
export const formatMaintenanceStatusLabel = (status?: string | null): string => {
  switch (status) {
    case 'requested':
      return 'diajukan';
    case 'scheduled':
      return 'disetujui';
    case 'in_progress':
      return 'diproses';
    case 'completed':
      return 'laporan pelaksanaan selesai dan menunggu verifikasi';
    case 'validated':
      return 'divalidasi';
    case 'cancelled':
      return 'dibatalkan';
    default:
      return status || 'diproses';
  }
};
export const shouldSendMaintenancePhoneNotification = (status?: string | null): boolean =>
  ['scheduled', 'in_progress', 'completed', 'validated', 'cancelled'].includes(String(status || ''));
interface CountRow extends RowDataPacket {
  count: number;
}

interface UserNotificationRow extends RowDataPacket {
  name?: string | null;
  phone_number?: string | null;
}

type MaintenanceSlaStatus = 'no_target' | 'on_track' | 'at_risk' | 'overdue' | 'met' | 'met_late';

export class MaintenanceService {
  async getTechnicianCandidates(search = '', limit = 20): Promise<ApiResponse<Array<{
    id: number;
    nip: string;
    name: string;
    role: string;
    workUnit: string | null;
    subWorkUnit: string | null;
  }>>> {
    const normalizedSearch = search.trim();
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const params: Array<string | number> = [];
    let searchClause = '';

    if (normalizedSearch) {
      searchClause = ' AND (name LIKE ? OR nip LIKE ? OR work_unit LIKE ?)';
      const keyword = `%${normalizedSearch}%`;
      params.push(keyword, keyword, keyword);
    }

    params.push(safeLimit);
    const [rows] = await pool.query<TechnicianAccountRow[]>(
      `SELECT id, nip, name, role, work_unit, sub_work_unit
       FROM users
       WHERE deleted_at IS NULL
         AND COALESCE(account_status, 'active') = 'active'
         ${searchClause}
       ORDER BY name ASC
       LIMIT ?`,
      params
    );

    return {
      success: true,
      message: 'Daftar akun teknisi/PJ berhasil dimuat',
      data: rows.map((row) => ({
        id: row.id,
        nip: row.nip,
        name: row.name,
        role: row.role,
        workUnit: row.work_unit,
        subWorkUnit: row.sub_work_unit,
      })),
    };
  }

  private async getActiveTechnicianAccount(userId: number): Promise<TechnicianAccountRow | null> {
    const [rows] = await pool.query<TechnicianAccountRow[]>(
      `SELECT id, nip, name, role, work_unit, sub_work_unit
       FROM users
       WHERE id = ?
         AND deleted_at IS NULL
         AND COALESCE(account_status, 'active') = 'active'
       LIMIT 1`,
      [userId]
    );
    return rows[0] ?? null;
  }
  private assetService: AssetService;
  private readonly activeStatuses = ['requested', 'scheduled', 'in_progress', 'completed'];
  private readonly detailActiveStatuses = ['requested', 'scheduled', 'in_progress', 'completed'];
  private readonly releasableStatuses = ['validated', 'cancelled'];
  private readonly listViewStatuses: Record<'active' | 'history', string[]> = {
    active: ['requested', 'scheduled', 'in_progress', 'completed'],
    history: ['validated', 'cancelled']
  };
  private readonly activeBorrowingStatuses = ['pending', 'approved', 'borrowed', 'overdue'];
  private readonly allowedStatusTransitions: Record<string, string[]> = {
    requested: ['scheduled', 'cancelled'],
    scheduled: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: ['validated', 'in_progress'],
    validated: [],
    cancelled: ['scheduled']
  };
  
  // Maintenance interval configuration (in months)
  private readonly maintenanceIntervals: Record<string, number> = {
    'preventive': 1,     // Rutin (Routine) - every 1 month
    'corrective': 3,     // Perbaikan (Repair) - every 3 months
    'calibration': 6,    // Kalibrasi - every 6 months
    'inspection': 12     // Inspeksi - every 12 months
  };
  private readonly automaticSlaHoursByPriority: Record<string, number> = {
    low: 72,
    normal: 48,
    high: 24,
    critical: 8,
  };
  private readonly slaAtRiskWindowMinutes = 120;
  private readonly approvalCostThreshold = 5000000;

  constructor() {
    this.assetService = new AssetService();
  }

  private parseDateValue(value?: string | Date | null): Date | null {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private buildAutomaticDueAt(scheduledDate: string, priority?: string | null): string | null {
    const normalizedPriority = String(priority || 'normal').toLowerCase();
    const leadHours = this.automaticSlaHoursByPriority[normalizedPriority] || this.automaticSlaHoursByPriority.normal;
    const scheduledAt = this.parseDateValue(scheduledDate);
    if (!scheduledAt) return null;

    const dueDate = new Date(scheduledAt.getTime() + leadHours * 60 * 60 * 1000);
    return formatDateTimeForMySQL(dueDate);
  }

  private buildSlaInsight(row: Partial<MaintenanceRow> & Record<string, any>): {
    slaStatus: MaintenanceSlaStatus;
    slaRemainingMinutes?: number;
    slaLateMinutes?: number;
  } {
    const dueAtRaw = row.due_at ?? row.dueAt;
    const dueAt = this.parseDateValue(dueAtRaw);
    if (!dueAt) {
      return { slaStatus: 'no_target' };
    }

    const status = String(row.status || '').toLowerCase();
    if (status === 'cancelled') {
      return { slaStatus: 'no_target' };
    }

    const completionSource = row.completed_date ?? row.completedDate ?? (status === 'validated' ? row.updated_at ?? row.updatedAt : null);
    const completedAt = this.parseDateValue(completionSource);
    if (completedAt) {
      const diffMinutes = Math.floor((completedAt.getTime() - dueAt.getTime()) / 60000);
      if (diffMinutes <= 0) {
        return {
          slaStatus: 'met',
          slaRemainingMinutes: Math.abs(diffMinutes),
        };
      }

      return {
        slaStatus: 'met_late',
        slaLateMinutes: diffMinutes,
      };
    }

    const now = new Date();
    const remainingMinutes = Math.floor((dueAt.getTime() - now.getTime()) / 60000);
    if (remainingMinutes < 0) {
      return {
        slaStatus: 'overdue',
        slaLateMinutes: Math.abs(remainingMinutes),
      };
    }

    if (remainingMinutes <= this.slaAtRiskWindowMinutes) {
      return {
        slaStatus: 'at_risk',
        slaRemainingMinutes: remainingMinutes,
      };
    }

    return {
      slaStatus: 'on_track',
      slaRemainingMinutes: remainingMinutes,
    };
  }

  private mapMaintenancePresentation(row: MaintenanceRow): Maintenance {
    return {
      ...row,
      scheduledDate: toLocalIsoDateTime(row.scheduledDate ?? row.scheduled_date ?? null),
      dueAt: toLocalIsoDateTime(row.dueAt ?? row.due_at ?? null),
      startedAt: toLocalIsoDateTime(row.startedAt ?? row.started_at ?? null),
      completedDate: toLocalIsoDateTime(row.completedDate ?? row.completed_date ?? null),
      estimatedDurationMinutes: row.estimatedDurationMinutes ?? row.estimated_duration_minutes,
      estimatedCost: row.estimatedCost ?? row.estimated_cost,
      damagePhotoUrl: row.damagePhotoUrl ?? row.damage_photo_url,
      beforePhotoUrl: row.beforePhotoUrl ?? row.before_photo_url,
      afterPhotoUrl: row.afterPhotoUrl ?? row.after_photo_url,
      actionTaken: row.actionTaken ?? row.action_taken,
      spareParts: row.spareParts ?? row.spare_parts,
      verificationResult: row.verificationResult ?? row.verification_result,
      finalCondition: row.finalCondition ?? row.final_condition,
      verificationNotes: row.verificationNotes ?? row.verification_notes,
      nextMaintenanceDate: row.nextMaintenanceDate ?? row.next_maintenance_date,
      actualStartAt: toLocalIsoDateTime(row.actualStartAt ?? row.actual_start_at ?? null),
      actualEndAt: toLocalIsoDateTime(row.actualEndAt ?? row.actual_end_at ?? null),
      validatedAt: toLocalIsoDateTime(row.validatedAt ?? row.validated_at ?? null),
      recurrenceInterval: row.recurrenceInterval ?? row.recurrence_interval,
      recurrenceEnabled: Boolean(row.recurrenceEnabled ?? row.recurrence_enabled),
      approvalStatus: row.approvalStatus ?? row.approval_status,
      approvalNotes: row.approvalNotes ?? row.approval_notes,
      approvedBy: row.approvedBy ?? row.approved_by,
      approvedAt: toLocalIsoDateTime(row.approvedAt ?? row.approved_at ?? null),
      reminderH7SentAt: toLocalIsoDateTime(row.reminderH7SentAt ?? row.reminder_h7_sent_at ?? null),
      reminderH3SentAt: toLocalIsoDateTime(row.reminderH3SentAt ?? row.reminder_h3_sent_at ?? null),
      reminderH1SentAt: toLocalIsoDateTime(row.reminderH1SentAt ?? row.reminder_h1_sent_at ?? null),
      costLabel: formatCostLabel(row.cost),
      requesterName: row.requester_name || undefined,
      requesterNip: row.requester_nip || undefined,
      requesterWorkUnit: row.requester_work_unit || undefined,
      requesterSubWorkUnit: row.requester_sub_work_unit || undefined,
      technicianNip: row.technician_nip || undefined,
      technicianRole: row.technician_role || undefined,
      technicianWorkUnit: row.technician_work_unit || undefined,
      validatorName: row.validator_name || undefined,
      validatorNip: row.validator_nip || undefined,
      ...this.buildSlaInsight(row)
    } as Maintenance;
  }

  private async recordStatusLog(
    maintenanceId: number | string,
    fromStatus: string | null,
    toStatus: string,
    changedBy?: number | null,
    note?: string | null
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO maintenance_status_logs (maintenance_id, from_status, to_status, changed_by, note)
         VALUES (?, ?, ?, ?, ?)`,
        [maintenanceId, fromStatus, toStatus, changedBy ?? null, note?.trim() || null]
      );
    } catch (error) {
      console.error('Error recording maintenance status audit:', error);
    }
  }

  private async hasActiveUsage(
    assetId: number,
    assetType: AssetType,
    detailId?: string | null
  ): Promise<boolean> {
    const normalizedDetailId = this.normalizeDetailIdentifier(detailId);
    const isFallback = this.isAssetFallbackDetailId(normalizedDetailId, assetId, assetType);

    if (!normalizedDetailId || isFallback) {
      const [rows] = await pool.query<CountRow[]>(
        `SELECT COUNT(*) as count FROM asset_usage_logs WHERE asset_id = ? AND COALESCE(asset_type,'medical') = ? AND ended_at IS NULL`,
        [assetId, assetType]
      );
      return (rows[0]?.count || 0) > 0;
    }

    const fallbackIds = this.getAssetFallbackDetailIds(assetId, assetType);
    const [rows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) as count FROM asset_usage_logs WHERE asset_id = ? AND COALESCE(asset_type,'medical') = ? AND ended_at IS NULL AND (
         asset_detail_id = ? OR asset_detail_id IS NULL OR asset_detail_id IN (?, ?)
       )`,
      [assetId, assetType, normalizedDetailId, fallbackIds[0], fallbackIds[1]]
    );
    return (rows[0]?.count || 0) > 0;
  }

  private normalizeAssetType(value?: string | null): AssetType {
    return value === 'non_medical' ? 'non_medical' : 'medical';
  }

  private normalizeAssetId(value?: string | number | null): number | null {
    if (value === undefined || value === null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private isActiveMaintenanceStatus(status?: string | null): boolean {
    if (!status) return false;
    return this.activeStatuses.includes(status);
  }

  private isDetailActiveMaintenanceStatus(status?: string | null): boolean {
    if (!status) return false;
    return this.detailActiveStatuses.includes(status);
  }

  private isReleasableMaintenanceStatus(status?: string | null): boolean {
    if (!status) return false;
    return this.releasableStatuses.includes(status);
  }

  private isAllowedStatusTransition(currentStatus?: string | null, nextStatus?: string | null): boolean {
    if (!currentStatus || !nextStatus) return false;
    if (currentStatus === nextStatus) return true;
    const allowedStatuses = this.allowedStatusTransitions[currentStatus] || [];
    return allowedStatuses.includes(nextStatus);
  }

  private getStatusTransitionError(currentStatus?: string | null, nextStatus?: string | null): string {
    if (!currentStatus || !nextStatus) {
      return 'Transisi status pemeliharaan tidak valid';
    }

    const transitionLabels: Record<string, string> = {
      requested: 'diajukan',
      scheduled: 'disetujui',
      in_progress: 'diproses',
      completed: 'menunggu validasi',
      validated: 'selesai',
      cancelled: 'ditolak/dibatalkan'
    };

    const currentLabel = transitionLabels[currentStatus] || currentStatus;
    const nextLabel = transitionLabels[nextStatus] || nextStatus;

    return `Status pemeliharaan tidak dapat diubah dari ${currentLabel} ke ${nextLabel}`;
  }

  private getBorrowingLockWhereClause(statusColumn: string, returnValidatedColumn: string): string {
    return `(${statusColumn} IN ('pending', 'approved', 'borrowed', 'overdue') OR (${statusColumn} = 'returned' AND ${returnValidatedColumn} IS NULL))`;
  }

  private formatDateOnly(value?: string | Date | null): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addMonths(value: Date, months: number): Date {
    const nextDate = new Date(value);
    nextDate.setMonth(nextDate.getMonth() + months);
    return nextDate;
  }

  private getRecurrenceMonths(interval?: string | null): number | null {
    switch (interval) {
      case 'monthly':
        return 1;
      case 'quarterly':
        return 3;
      case 'yearly':
        return 12;
      default:
        return null;
    }
  }

  private shouldRequireApproval(data: {
    priority?: string | null;
    estimatedCost?: number | string | null;
    cost?: number | string | null;
    approvalStatus?: string | null;
  }): boolean {
    if (data.approvalStatus && data.approvalStatus !== 'not_required') return true;
    const cost = Number(data.estimatedCost ?? data.cost ?? 0);
    return data.priority === 'critical' || (Number.isFinite(cost) && cost >= this.approvalCostThreshold);
  }

  private buildApprovalStatus(data: CreateMaintenanceDTO | UpdateMaintenanceDTO): string {
    if (data.approvalStatus) return data.approvalStatus;
    return this.shouldRequireApproval(data) ? 'pending' : 'not_required';
  }

  private async createNextRecurringMaintenance(source: Record<string, any>, validatedBy: number): Promise<void> {
    const recurrenceEnabled = Boolean(source.recurrenceEnabled ?? source.recurrence_enabled);
    const recurrenceInterval = source.recurrenceInterval ?? source.recurrence_interval;
    const months = this.getRecurrenceMonths(recurrenceInterval);
    if (!recurrenceEnabled || !months) return;

    const sourceId = this.normalizeAssetId(source.id);
    const assetId = this.normalizeAssetId(source.assetId ?? source.asset_id);
    if (!sourceId || !assetId) return;

    const existingNext = await this.getExistingRecurringChild(sourceId);
    if (existingNext) return;

    const explicitNextDate = this.parseDateValue(source.nextMaintenanceDate ?? source.next_maintenance_date);
    const baseDate =
      explicitNextDate ??
      this.parseDateValue(source.completedDate ?? source.completed_date) ??
      this.parseDateValue(source.scheduledDate ?? source.scheduled_date) ??
      new Date();
    const scheduledDate = explicitNextDate ?? this.addMonths(baseDate, months);

    await this.create({
      assetId,
      assetType: this.normalizeAssetType(source.assetType ?? source.asset_type),
      assetDetailId: source.assetDetailId ?? source.asset_detail_id ?? undefined,
      assetDetailName: source.assetDetailName ?? source.asset_detail_name ?? undefined,
      assetDetailCode: source.assetDetailCode ?? source.asset_detail_code ?? undefined,
      type: source.type || 'preventive',
      priority: source.priority || 'normal',
      status: 'scheduled',
      scheduledDate,
      description: `Jadwal preventif otomatis dari ${source.maintenanceCode ?? source.maintenance_code ?? `#${sourceId}`}`,
      technician: source.technician ?? undefined,
      technicianUserId: source.technicianUserId ?? source.technician_user_id ?? undefined,
      recurrenceInterval,
      recurrenceEnabled: true,
      approvalStatus: 'not_required',
      notes: `AUTO_RECURRING_SOURCE:${sourceId}`,
      createdBy: validatedBy,
    });
  }

  private async getExistingRecurringChild(sourceId: number): Promise<boolean> {
    const [rows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) as count FROM maintenance_records
       WHERE notes LIKE ? AND deleted_at IS NULL`,
      [`%AUTO_RECURRING_SOURCE:${sourceId}%`]
    );
    return (rows[0]?.count || 0) > 0;
  }

  private parseAssetSpecifications(raw: unknown): Record<string, any> {
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
  }

  private isInUseAssetStatus(status?: string | null): boolean {
    const normalized = String(status || '').toLowerCase();
    return [
      'sedang digunakan',
      'dalam penggunaan',
      'in_use',
      'in use'
    ].some((value) => normalized.includes(value));
  }

  private normalizeDetailIdentifier(value?: string | number | null): string {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  private getAssetFallbackDetailIds(assetId: number, assetType: AssetType): string[] {
    const normalizedAssetType = assetType === 'non_medical' ? 'non_medical' : 'medical';
    return [`asset-${assetId}`, `asset-${normalizedAssetType}-${assetId}`];
  }

  private isAssetFallbackDetailId(
    detailId?: string | null,
    assetId?: number | null,
    assetType?: AssetType
  ): boolean {
    if (!detailId || !assetId || !assetType) return false;
    return this.getAssetFallbackDetailIds(assetId, assetType).includes(
      this.normalizeDetailIdentifier(detailId)
    );
  }

  /**
   * A maintenance record normally targets one inventory detail.  Only records
   * without a detail (or using the generated whole-asset fallback) may change
   * the status of the parent asset.  Otherwise one repaired tool would lock
   * every tool stored under the same asset/room.
   */
  private isSpecificDetailTarget(
    assetId: number,
    assetType: AssetType,
    detailId?: string | null,
    detailCode?: string | null
  ): boolean {
    const normalizedDetailId = this.normalizeDetailIdentifier(detailId);
    const normalizedDetailCode = this.normalizeDetailIdentifier(detailCode);

    if (!normalizedDetailId && !normalizedDetailCode) return false;

    return !this.isAssetFallbackDetailId(normalizedDetailId, assetId, assetType);
  }

  private getMaintenanceInterval(maintenanceType?: string | null): number {
    if (!maintenanceType) return 1; // Default to 1 month
    return this.maintenanceIntervals[maintenanceType] || 1;
  }

  private getActiveMaintenanceDetailStatus(maintenanceType?: string | null): string {
    switch (maintenanceType) {
      case 'preventive':
        return 'Dalam Pemeliharaan';
      case 'calibration':
        return 'Dalam Kalibrasi';
      case 'inspection':
        return 'Dalam Inspeksi';
      case 'corrective':
      default:
        return 'Dalam Perbaikan';
    }
  }

  private matchesAssetDetail(
    detail: Record<string, any>,
    detailId?: string | null,
    detailCode?: string | null
  ): boolean {
    const normalizedTargetId = this.normalizeDetailIdentifier(detailId);
    const normalizedTargetCode = this.normalizeDetailIdentifier(detailCode);
    const detailCandidates = [
      this.normalizeDetailIdentifier(detail.id),
      this.normalizeDetailIdentifier(detail.detailId),
      this.normalizeDetailIdentifier(detail.assetDetailId),
      this.normalizeDetailIdentifier(detail.assetCode),
      this.normalizeDetailIdentifier(detail.detailCode),
      this.normalizeDetailIdentifier(detail.serialNumber)
    ].filter(Boolean);

    if (normalizedTargetId && detailCandidates.includes(normalizedTargetId)) {
      return true;
    }

    if (normalizedTargetCode && detailCandidates.includes(normalizedTargetCode)) {
      return true;
    }

    return false;
  }

  private async syncAssetDetailMaintenance(
    assetId: number,
    assetType: AssetType,
    maintenanceStatus?: string | null,
    options?: {
      detailId?: string | null;
      detailCode?: string | null;
      completedAt?: string | Date | null;
      scheduledAt?: string | Date | null;
      maintenanceType?: string | null;
      cancellationReason?: string | null;
    }
  ): Promise<void> {
    if (!maintenanceStatus) return;

    const detailId = this.normalizeDetailIdentifier(options?.detailId);
    const detailCode = this.normalizeDetailIdentifier(options?.detailCode);
    const shouldMatchSpecificDetail = Boolean(detailId || detailCode);

    const assetResponse = await this.assetService.getById(String(assetId), assetType);
    if (!assetResponse.success || !assetResponse.data) return;

    const specifications = this.parseAssetSpecifications(assetResponse.data.specifications);
    const details = Array.isArray(specifications.details) ? specifications.details : [];
    if (details.length === 0) return;

    let hasChanges = false;
    const completionDateSource = options?.completedAt || options?.scheduledAt || new Date();
    const completedDateOnly = this.formatDateOnly(completionDateSource);
    const isCorrectiveMaintenance = options?.maintenanceType === 'corrective';
    const activeDetailStatus = this.getActiveMaintenanceDetailStatus(options?.maintenanceType);
    
    // Calculate next maintenance date based on maintenance type interval
    const maintenanceInterval = this.getMaintenanceInterval(options?.maintenanceType);
    const nextMaintenanceDateOnly = completedDateOnly && !isCorrectiveMaintenance
      ? this.formatDateOnly(this.addMonths(new Date(completionDateSource), maintenanceInterval))
      : null;

    const updatedDetails = details.map((rawDetail: any) => {
      const detail = rawDetail && typeof rawDetail === 'object' ? { ...rawDetail } : rawDetail;
      if (!detail || typeof detail !== 'object') return rawDetail;

      const isTarget = shouldMatchSpecificDetail
        ? this.matchesAssetDetail(detail, detailId, detailCode)
        : true;

      if (!isTarget) return rawDetail;

      if (this.isDetailActiveMaintenanceStatus(maintenanceStatus)) {
        if (detail.status !== activeDetailStatus) {
          detail.status = activeDetailStatus;
          hasChanges = true;
        }
        return detail;
      }

      if (!this.isReleasableMaintenanceStatus(maintenanceStatus)) {
        return rawDetail;
      }

      if (detail.status !== 'Tersedia') {
        detail.status = 'Tersedia';
        hasChanges = true;
      }

      if (maintenanceStatus === 'cancelled' && detail.condition !== 'Baik') {
        detail.condition = 'Baik';
        hasChanges = true;
      }

      if ((maintenanceStatus === 'completed' || maintenanceStatus === 'validated') && detail.condition !== 'Baik') {
        detail.condition = 'Baik';
        hasChanges = true;
      }

      if (
        (maintenanceStatus === 'completed' || maintenanceStatus === 'validated') &&
        completedDateOnly
      ) {
        if (isCorrectiveMaintenance) {
          if (detail.lastRepair !== completedDateOnly) {
            detail.lastRepair = completedDateOnly;
            hasChanges = true;
          }
        } else if (detail.lastMaintenance !== completedDateOnly) {
          detail.lastMaintenance = completedDateOnly;
          hasChanges = true;
        }
        if (nextMaintenanceDateOnly && detail.nextMaintenance !== nextMaintenanceDateOnly) {
          detail.nextMaintenance = nextMaintenanceDateOnly;
          hasChanges = true;
        }
      }

      return detail;
    });

    if (!hasChanges) return;

    await this.assetService.update(
      String(assetId),
      {
        specifications: {
          ...specifications,
          details: updatedDetails
        }
      },
      assetType
    );
  }

  private async hasOtherActiveMaintenance(
    assetId: number,
    assetType: AssetType,
    excludeMaintenanceId?: string | number
  ): Promise<boolean> {
    const params: any[] = [assetId, assetType, ...this.activeStatuses];
    let query = `
      SELECT COUNT(*) as count
      FROM maintenance_records
      WHERE asset_id = ?
        AND COALESCE(asset_type, 'medical') = ?
        AND status IN (?, ?, ?, ?)
        AND deleted_at IS NULL
    `;

    if (excludeMaintenanceId !== undefined && excludeMaintenanceId !== null) {
      query += ' AND id <> ?';
      params.push(excludeMaintenanceId);
    }

    const [rows] = await pool.query<CountRow[]>(query, params);
    return (rows[0]?.count || 0) > 0;
  }

  private async hasActiveBorrowingForMaintenance(
    assetId: number,
    assetType: AssetType,
    detailId?: string | null
  ): Promise<boolean> {
    const normalizedDetailId = this.normalizeDetailIdentifier(detailId);
    const isAssetFallbackDetail = this.isAssetFallbackDetailId(
      normalizedDetailId,
      assetId,
      assetType
    );

    if (!normalizedDetailId || isAssetFallbackDetail) {
      const [rows] = await pool.query<CountRow[]>(
        `SELECT COUNT(*) as count
         FROM borrowing_records
         WHERE asset_id = ?
           AND COALESCE(asset_type, 'medical') = ?
           AND ${this.getBorrowingLockWhereClause('status', 'return_validated_at')}`,
        [assetId, assetType]
      );

      return (rows[0]?.count || 0) > 0;
    }

    const fallbackDetailIds = this.getAssetFallbackDetailIds(assetId, assetType);
    const [rows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) as count
       FROM borrowing_records
       WHERE asset_id = ?
         AND COALESCE(asset_type, 'medical') = ?
         AND ${this.getBorrowingLockWhereClause('status', 'return_validated_at')}
         AND (
           asset_detail_id = ?
           OR asset_detail_id IS NULL
           OR asset_detail_id IN (?, ?)
         )`,
      [
        assetId,
        assetType,
        normalizedDetailId,
        fallbackDetailIds[0],
        fallbackDetailIds[1]
      ]
    );

    return (rows[0]?.count || 0) > 0;
  }

  private async validateBorrowingLockForMaintenance(
    assetId: number,
    assetType: AssetType,
    detailId?: string | null
  ): Promise<ApiResponse | null> {
    const hasActiveBorrowing = await this.hasActiveBorrowingForMaintenance(
      assetId,
      assetType,
      detailId
    );

    if (!hasActiveBorrowing) {
      return null;
    }

    return {
      success: false,
      message: 'Aset masih dalam peminjaman aktif atau pengembalian belum divalidasi sehingga belum bisa dipelihara'
    };
  }

  private async validateUsageLockForMaintenance(
    assetId: number,
    assetType: AssetType,
    detailId?: string | null
  ): Promise<ApiResponse | null> {
    const hasActiveUsage = await this.hasActiveUsage(assetId, assetType, detailId);
    if (!hasActiveUsage) {
      return null;
    }

    return {
      success: false,
      message: 'Alat sedang digunakan sehingga belum dapat ditambahkan pemeliharaan'
    };
  }

  private validateStatusUsageLockForMaintenance(
    asset: Asset,
    detailId?: string | null,
    detailCode?: string | null
  ): ApiResponse | null {
    if (this.isInUseAssetStatus(asset.status)) {
      return {
        success: false,
        message: 'Alat sedang digunakan sehingga belum dapat ditambahkan pemeliharaan'
      };
    }

    const normalizedDetailId = this.normalizeDetailIdentifier(detailId);
    const normalizedDetailCode = this.normalizeDetailIdentifier(detailCode);
    const specifications = this.parseAssetSpecifications(asset.specifications);
    const details = Array.isArray(specifications.details) ? specifications.details : [];

    const hasInUseDetail = details.some((rawDetail: any) => {
      const detail = rawDetail && typeof rawDetail === 'object' ? rawDetail : {};
      const isTarget = normalizedDetailId || normalizedDetailCode
        ? this.matchesAssetDetail(detail, normalizedDetailId, normalizedDetailCode)
        : true;
      return isTarget && this.isInUseAssetStatus(detail.status);
    });

    if (!hasInUseDetail) {
      return null;
    }

    return {
      success: false,
      message: 'Alat sedang digunakan sehingga belum dapat ditambahkan pemeliharaan'
    };
  }

  private async syncAssetAvailability(
    assetId: number,
    assetType: AssetType,
    maintenanceStatus?: string | null,
    excludeMaintenanceId?: string | number,
    detailId?: string | null,
    detailCode?: string | null
  ): Promise<void> {
    if (this.isSpecificDetailTarget(assetId, assetType, detailId, detailCode)) {
      return;
    }

    if (this.isActiveMaintenanceStatus(maintenanceStatus)) {
      await this.assetService.updateStatus(String(assetId), 'maintenance', assetType);
      return;
    }

    if (!this.isReleasableMaintenanceStatus(maintenanceStatus)) {
      return;
    }

    const stillHasActiveMaintenance = await this.hasOtherActiveMaintenance(
      assetId,
      assetType,
      excludeMaintenanceId
    );

    if (!stillHasActiveMaintenance) {
      await this.assetService.updateStatus(String(assetId), 'available', assetType);
    }
  }

  private async resolveAssetForMaintenance(
    assetId: number,
    preferredType?: AssetType
  ): Promise<{ asset: ApiResponse<Asset>; type: AssetType } | null> {
    const candidates: AssetType[] = preferredType ? [preferredType] : ['medical', 'non_medical'];

    for (const candidate of candidates) {
      const assetResponse = await this.assetService.getById(String(assetId), candidate);
      if (assetResponse.success && assetResponse.data) {
        return { asset: assetResponse, type: candidate };
      }
    }

    return null;
  }

  private async getUserNotificationTarget(userId?: number | string | null): Promise<{ name?: string; phoneNumber?: string } | null> {
    const normalizedUserId = this.normalizeAssetId(userId);
    if (!normalizedUserId) return null;

    const [rows] = await pool.query<UserNotificationRow[]>(
      'SELECT name, phone_number FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [normalizedUserId]
    );

    const row = rows[0];
    if (!row) return null;

    return {
      name: row.name || undefined,
      phoneNumber: row.phone_number || undefined,
    };
  }

  private async notifyMaintenancePhone(params: {
    userId?: number | string | null;
    action: 'created' | 'scheduled' | 'in_progress' | 'completed' | 'validated' | 'cancelled';
    maintenanceCode?: string | null;
    assetName?: string | null;
    status?: string | null;
    scheduledDate?: string | Date | null;
  }): Promise<void> {
    try {
      const target = await this.getUserNotificationTarget(params.userId);

      const code = params.maintenanceCode ? ` ${params.maintenanceCode}` : '';
      const assetName = params.assetName || 'aset';
      const statusLabel = formatMaintenanceStatusLabel(params.status);
      const scheduleSuffix = this.formatDateOnly(params.scheduledDate)
        ? ` Jadwal: ${this.formatDateOnly(params.scheduledDate)}.`
        : '';
      const titleMap: Record<'created' | 'scheduled' | 'in_progress' | 'completed' | 'validated' | 'cancelled', string> = {
        created: 'Pemeliharaan baru dibuat',
        scheduled: 'Pemeliharaan disetujui',
        in_progress: 'Pemeliharaan diproses',
        completed: 'Laporan pemeliharaan menunggu verifikasi',
        validated: 'Pemeliharaan divalidasi',
        cancelled: 'Pemeliharaan dibatalkan',
      };

      // In-app notification (works regardless of whether a phone number exists)
      const targetUserId = this.normalizeAssetId(params.userId);
      if (targetUserId) {
        void notificationService.create({
          userId: targetUserId,
          type: `maintenance_${params.action}`,
          category: 'maintenance',
          title: titleMap[params.action],
          message: `${assetName}${code} ${statusLabel}.${scheduleSuffix}`.trim(),
          link: '/maintenance',
          referenceType: 'maintenance',
          referenceId: undefined,
        });
      }

      if (!target?.phoneNumber) return;

      await sendPhoneNotification({
        phoneNumber: target.phoneNumber,
        userName: target.name,
        title: titleMap[params.action],
        message: `${assetName}${code} ${statusLabel}.${scheduleSuffix}`,
        referenceCode: params.maintenanceCode || undefined,
        referenceType: 'maintenance',
        link: '/maintenance',
        // Kebijakan matriks: pemeliharaan memakai WhatsApp, bukan SMS (SMS khusus darurat/OTP).
        channels: ['whatsapp'],
      });
    } catch (error) {
      console.error('[Maintenance Notification] Gagal mengirim notifikasi HP:', error);
    }
  }

  async getAll(filters: MaintenanceFilters): Promise<PaginatedResponse<Maintenance>> {
    const { page, limit, status, view, assetId, assetType, type, automationSource, actorUserId, actorRole, actorWorkUnit } = filters;
    const offset = (page - 1) * limit;
    const scopedActorId = Number(actorUserId);
    const hasValidActorId = Number.isFinite(scopedActorId) && scopedActorId > 0;
    const isFullAccess = hasAnyRole(actorRole, ['admin', 'leader', 'teknisi']);
    const isStaffPj = hasAnyRole(actorRole, ['staff_pj', 'staff pj']);
    const scopedWorkUnit = normalizeComparableText(actorWorkUnit);
    const shouldScopeToWorkUnit = isStaffPj && hasValidActorId && Boolean(scopedWorkUnit);
    const shouldScopeToActor = hasValidActorId && !isFullAccess && !shouldScopeToWorkUnit;

    let query = `
      SELECT m.*,
        COALESCE(ma.name, na.name) as asset_name,
        COALESCE(ma.asset_code, na.asset_code) as asset_code,
        COALESCE(ma.location, na.location) as asset_location,
        COALESCE(m.asset_type, ma.type, 'medical') as asset_type,
        u.name as requester_name,
        u.nip as requester_nip,
        u.work_unit as requester_work_unit,
        u.sub_work_unit as requester_sub_work_unit,
        v.name as validator_name,
        v.nip as validator_nip,
        t.nip as technician_nip,
        t.role as technician_role,
        t.work_unit as technician_work_unit
      FROM maintenance_records m
      LEFT JOIN medical_assets ma ON (m.asset_type IS NULL OR m.asset_type = 'medical') AND m.asset_id = ma.id
      LEFT JOIN non_medical_assets na ON m.asset_type = 'non_medical' AND m.asset_id = na.id
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN users v ON m.validated_by = v.id
      LEFT JOIN users t ON m.technician_user_id = t.id
      WHERE m.deleted_at IS NULL
    `;
    let countQuery = 'SELECT COUNT(*) as count FROM maintenance_records WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (status) {
      query += ' AND m.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
    } else if (view) {
      const statuses = this.listViewStatuses[view];
      if (statuses?.length) {
        const placeholders = statuses.map(() => '?').join(', ');
        query += ` AND m.status IN (${placeholders})`;
        countQuery += ` AND status IN (${placeholders})`;
        params.push(...statuses);
      }
    }

    if (assetId) {
      query += ' AND m.asset_id = ?';
      countQuery += ' AND asset_id = ?';
      params.push(assetId);
    }

    if (assetType) {
      query += " AND COALESCE(m.asset_type, 'medical') = ?";
      countQuery += " AND COALESCE(asset_type, 'medical') = ?";
      params.push(assetType);
    }

    if (type) {
      query += ' AND m.type = ?';
      countQuery += ' AND type = ?';
      params.push(type);
    }

    if (automationSource === 'usage_threshold') {
      query += " AND COALESCE(m.notes, '') LIKE 'AUTO_USAGE_THRESHOLD%'";
      countQuery += " AND COALESCE(notes, '') LIKE 'AUTO_USAGE_THRESHOLD%'";
    } else if (automationSource === 'manual') {
      query += " AND COALESCE(m.notes, '') NOT LIKE 'AUTO_USAGE_THRESHOLD%'";
      countQuery += " AND COALESCE(notes, '') NOT LIKE 'AUTO_USAGE_THRESHOLD%'";
    }

    if (shouldScopeToWorkUnit) {
      query += ' AND LOWER(TRIM(u.work_unit)) = ?';
      countQuery += ' AND created_by IN (SELECT id FROM users WHERE LOWER(TRIM(work_unit)) = ?)';
      params.push(scopedWorkUnit);
    } else if (shouldScopeToActor) {
      query += ' AND (m.created_by = ? OR m.completed_by = ?)';
      countQuery += ' AND (created_by = ? OR completed_by = ?)';
      params.push(scopedActorId, scopedActorId);
    }

    const countParams = [...params];
    query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [dataRows] = await pool.query<MaintenanceRow[]>(query, params);
    const [countRows] = await pool.query<CountRow[]>(countQuery, countParams);

    const total = countRows[0].count;

    const dataWithLabel = dataRows.map((row) => this.mapMaintenancePresentation(row));
    return {
      success: true,
      message: 'Maintenance records retrieved successfully',
      data: dataWithLabel,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async getById(id: string): Promise<ApiResponse<Maintenance>> {
    const [rows] = await pool.query<MaintenanceRow[]>(
      `SELECT m.*,
        COALESCE(ma.name, na.name) as asset_name,
        COALESCE(ma.asset_code, na.asset_code) as asset_code,
        COALESCE(ma.location, na.location) as asset_location,
        COALESCE(m.asset_type, ma.type, 'medical') as asset_type,
        u.name as requester_name,
        u.nip as requester_nip,
        u.work_unit as requester_work_unit,
        u.sub_work_unit as requester_sub_work_unit,
        v.name as validator_name,
        v.nip as validator_nip,
        t.nip as technician_nip,
        t.role as technician_role,
        t.work_unit as technician_work_unit
       FROM maintenance_records m
       LEFT JOIN medical_assets ma ON (m.asset_type IS NULL OR m.asset_type = 'medical') AND m.asset_id = ma.id
       LEFT JOIN non_medical_assets na ON m.asset_type = 'non_medical' AND m.asset_id = na.id
       LEFT JOIN users u ON m.created_by = u.id
       LEFT JOIN users v ON m.validated_by = v.id
       LEFT JOIN users t ON m.technician_user_id = t.id
      WHERE m.id = ?
        AND m.deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Maintenance record not found' };
    }

    const dataWithLabel = this.mapMaintenancePresentation(rows[0]);
    return { success: true, message: 'Maintenance record retrieved successfully', data: dataWithLabel };
  }

  async create(data: CreateMaintenanceDTO): Promise<ApiResponse<Maintenance>> {
    const maintenanceCode = generateMaintenanceCode();

    const statusValue = data.status || 'requested';
    if (!['requested', 'scheduled'].includes(statusValue)) {
      return {
        success: false,
        message: 'Status awal pemeliharaan hanya boleh diajukan atau disetujui'
      };
    }

    const resolvedAsset = await this.resolveAssetForMaintenance(data.assetId, data.assetType);
    if (!resolvedAsset) {
      return { success: false, message: 'Asset not found for maintenance' };
    }
    const { asset, type: resolvedType } = resolvedAsset;

    const statusUsageLockError = this.validateStatusUsageLockForMaintenance(
      asset.data as Asset,
      data.assetDetailId || null,
      data.assetDetailCode || null
    );
    if (statusUsageLockError) {
      return statusUsageLockError;
    }

    const usageLockError = await this.validateUsageLockForMaintenance(
      data.assetId,
      resolvedType,
      data.assetDetailId || null
    );
    if (usageLockError) {
      return usageLockError;
    }

    if (this.isActiveMaintenanceStatus(statusValue)) {
      const borrowingLockError = await this.validateBorrowingLockForMaintenance(
        data.assetId,
        resolvedType,
        data.assetDetailId
      );
      if (borrowingLockError) {
        return borrowingLockError;
      }
    }

    const scheduledDateValue = formatDateTimeForMySQL(data.scheduledDate);
    if (!scheduledDateValue) {
      return { success: false, message: 'Scheduled date is invalid' };
    }

    const dueAtValue = data.dueAt
      ? formatDateTimeForMySQL(data.dueAt)
      : this.buildAutomaticDueAt(scheduledDateValue, data.priority);
    if (data.dueAt && !dueAtValue) {
      return { success: false, message: 'Due date is invalid' };
    }
    const startedAtValue = data.startedAt || data.actualStartAt
      ? formatDateTimeForMySQL(data.startedAt || data.actualStartAt)
      : null;
    const completedDateValue = data.completedDate || data.actualEndAt
      ? formatDateTimeForMySQL(data.completedDate || data.actualEndAt)
      : null;
    const recurrenceInterval = data.recurrenceInterval || 'none';
    const recurrenceEnabled = Boolean(data.recurrenceEnabled && recurrenceInterval !== 'none');
    const approvalStatus = this.buildApprovalStatus(data);

    const descriptionValue = data.description || '';
    const technicianAccount = data.technicianUserId
      ? await this.getActiveTechnicianAccount(Number(data.technicianUserId))
      : null;
    if (data.technicianUserId && !technicianAccount) {
      return { success: false, message: 'Akun teknisi/PJ tidak ditemukan atau sudah tidak aktif' };
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO maintenance_records (
         maintenance_code,
         asset_id,
         asset_type,
         asset_detail_id,
         asset_detail_name,
         asset_detail_code,
         schedule_id,
         type,
         priority,
         status,
         scheduled_date,
         due_at,
         started_at,
         completed_date,
         description,
         technician,
         technician_user_id,
         vendor_name,
         vendor_reference,
         warranty_until,
         estimated_duration_minutes,
         estimated_cost,
         damage_photo_url,
         before_photo_url,
         after_photo_url,
         diagnosis,
         action_taken,
         checklist,
         spare_parts,
         verification_result,
         final_condition,
         verification_notes,
         next_maintenance_date,
         actual_start_at,
         actual_end_at,
         recurrence_interval,
         recurrence_enabled,
         approval_status,
         approval_notes,
         approved_by,
         approved_at,
         cost,
         notes,
         cancellation_reason,
         created_by
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        maintenanceCode,
        data.assetId,
        resolvedType,
        data.assetDetailId || null,
        data.assetDetailName || null,
        data.assetDetailCode || null,
        data.scheduleId || null,
        data.type,
        data.priority || 'normal',
        statusValue,
        scheduledDateValue,
        dueAtValue,
        startedAtValue,
        completedDateValue,
        descriptionValue,
        technicianAccount?.name ?? data.technician ?? null,
        data.technicianUserId || null,
        data.vendorName || null,
        data.vendorReference || null,
        data.warrantyUntil ? this.formatDateOnly(data.warrantyUntil) : null,
        data.estimatedDurationMinutes || null,
        data.estimatedCost || null,
        data.damagePhotoUrl || null,
        data.beforePhotoUrl || null,
        data.afterPhotoUrl || null,
        data.diagnosis || null,
        data.actionTaken || null,
        data.checklist || null,
        data.spareParts || null,
        data.verificationResult || null,
        data.finalCondition || null,
        data.verificationNotes || null,
        data.nextMaintenanceDate ? this.formatDateOnly(data.nextMaintenanceDate) : null,
        startedAtValue,
        completedDateValue,
        recurrenceInterval,
        recurrenceEnabled ? 1 : 0,
        approvalStatus,
        data.approvalNotes || null,
        data.approvedBy || null,
        data.approvedAt ? formatDateTimeForMySQL(data.approvedAt) : null,
        data.cost || null,
        data.notes || null,
        data.cancellationReason || null,
        data.createdBy
      ]
    );

    const [newRows] = await pool.query<MaintenanceRow[]>(
      'SELECT * FROM maintenance_records WHERE id = ? AND deleted_at IS NULL',
      [result.insertId]
    );
    const newMaintenance = newRows[0];
    await this.recordStatusLog(newMaintenance.id, null, newMaintenance.status, data.createdBy, 'Pemeliharaan dibuat');

    await this.syncAssetAvailability(
      data.assetId,
      resolvedType,
      statusValue,
      newMaintenance.id,
      data.assetDetailId,
      data.assetDetailCode
    );

    await this.syncAssetDetailMaintenance(data.assetId, resolvedType, statusValue, {
      detailId: data.assetDetailId,
      detailCode: data.assetDetailCode,
      scheduledAt: data.scheduledDate,
      maintenanceType: data.type,
      cancellationReason: data.cancellationReason
    });

    // Create maintenance history entry
    try {
      await MaintenanceHistoryService.create({
        maintenanceId: newMaintenance.id,
        assetId: newMaintenance.asset_id,
        type: newMaintenance.type,
        status: newMaintenance.status,
        scheduledDate: newMaintenance.scheduled_date,
        description: newMaintenance.description || '',
        technician: newMaintenance.technician || undefined,
        cost: newMaintenance.cost || undefined,
        notes: newMaintenance.notes || undefined,
        createdBy: newMaintenance.created_by || data.createdBy,
      });
    } catch (historyError) {
      console.error('Error creating maintenance history:', historyError);
      // Continue even if history fails, as the main record is created
    }

    const dataWithLabel = this.mapMaintenancePresentation(newMaintenance);

    if (shouldSendMaintenancePhoneNotification(newMaintenance.status)) {
      await this.notifyMaintenancePhone({
        userId: newMaintenance.created_by || data.createdBy,
        action: newMaintenance.status as 'scheduled' | 'in_progress' | 'completed' | 'validated' | 'cancelled',
        maintenanceCode,
        assetName: asset.data?.name || newMaintenance.asset_detail_name || undefined,
        status: newMaintenance.status,
        scheduledDate: newMaintenance.scheduled_date ?? scheduledDateValue,
      });
    }

    return { success: true, message: 'Maintenance record created successfully', data: dataWithLabel };
  }

  async update(id: string, data: UpdateMaintenanceDTO, changedBy?: number | null): Promise<ApiResponse<Maintenance>> {
    const existing = await this.getById(id);
    if (!existing.success) return existing;

    const existingMaintenance = existing.data as unknown as Record<string, any>;
    const existingAssetId = this.normalizeAssetId(
      existingMaintenance.assetId ?? existingMaintenance.asset_id
    );
    const existingAssetType = this.normalizeAssetType(
      existingMaintenance.assetType ?? existingMaintenance.asset_type
    );
    const nextAssetId = this.normalizeAssetId(data.assetId) ?? existingAssetId;
    const nextAssetType = this.normalizeAssetType(data.assetType ?? existingAssetType);
    const nextStatus = data.status ?? existingMaintenance.status;
    const existingDetailId = this.normalizeDetailIdentifier(
      existingMaintenance.assetDetailId ?? existingMaintenance.asset_detail_id
    );
    const existingDetailCode = this.normalizeDetailIdentifier(
      existingMaintenance.assetDetailCode ?? existingMaintenance.asset_detail_code
    );
    const nextDetailId = this.normalizeDetailIdentifier(data.assetDetailId) || existingDetailId;
    const nextDetailCode = this.normalizeDetailIdentifier(data.assetDetailCode) || existingDetailCode;
    const nextScheduledDate =
      data.scheduledDate ?? existingMaintenance.scheduledDate ?? existingMaintenance.scheduled_date;
    const nextMaintenanceType = data.type ?? existingMaintenance.type ?? existingMaintenance.maintenance_type;
    const currentStatus = existingMaintenance.status as string | undefined;
    // Reopening a cancelled/rejected maintenance drops the previous rejection
    // reason unless a new one is explicitly provided in this update.
    const isReopeningFromCancelled =
      currentStatus === 'cancelled' && data.status !== undefined && data.status !== 'cancelled';
    const nextCancellationReason = isReopeningFromCancelled
      ? data.cancellationReason ?? undefined
      : data.cancellationReason ??
        existingMaintenance.cancellationReason ??
        existingMaintenance.cancellation_reason;

    if (
      existingMaintenance.status === 'validated' &&
      data.status !== undefined &&
      data.status !== 'validated'
    ) {
      return {
        success: false,
        message: 'Pemeliharaan yang sudah tervalidasi tidak dapat diubah ke status lain'
      };
    }

    if (
      data.status !== undefined &&
      !this.isAllowedStatusTransition(currentStatus, data.status)
    ) {
      return {
        success: false,
        message: this.getStatusTransitionError(currentStatus, data.status)
      };
    }

    // Enforce required fields when approving/scheduling a maintenance.
    // Technician/PJ assignment is optional at this stage ("bisa tunjuk teknisi") —
    // it is still enforced below before work can move to 'in_progress'.
    if (data.status === 'scheduled' && currentStatus !== 'scheduled') {
      const effectiveScheduled = nextScheduledDate;
      const formattedScheduled = effectiveScheduled ? formatDateTimeForMySQL(effectiveScheduled) : null;
      if (!formattedScheduled) {
        return { success: false, message: 'Jadwal pelaksanaan wajib diisi saat menyetujui pemeliharaan' };
      }
    }

    if (data.status === 'in_progress' && currentStatus !== 'in_progress') {
      const technicianUserId = this.normalizeAssetId(
        data.technicianUserId ?? existingMaintenance.technicianUserId ?? existingMaintenance.technician_user_id
      );
      if (!technicianUserId) {
        return {
          success: false,
          message: 'Pilih akun teknisi/PJ sebelum memulai pelaksanaan pemeliharaan'
        };
      }
      if (!nextScheduledDate || !formatDateTimeForMySQL(nextScheduledDate)) {
        return {
          success: false,
          message: 'Jadwal pelaksanaan wajib diisi sebelum pekerjaan dimulai'
        };
      }
    }

    if (nextAssetId && this.isActiveMaintenanceStatus(nextStatus)) {
      const borrowingLockError = await this.validateBorrowingLockForMaintenance(
        nextAssetId,
        nextAssetType,
        nextDetailId
      );
      if (borrowingLockError) {
        return borrowingLockError;
      }
    }

    if (data.technicianUserId !== undefined) {
      const technicianAccount = await this.getActiveTechnicianAccount(Number(data.technicianUserId));
      if (!technicianAccount) {
        return { success: false, message: 'Akun teknisi/PJ tidak ditemukan atau sudah tidak aktif' };
      }
      data.technician = technicianAccount.name;
    }

    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        let normalizedValue = value;
        if (key === 'scheduledDate' || key === 'dueAt' || key === 'startedAt' || key === 'completedDate' || key === 'actualStartAt' || key === 'actualEndAt' || key === 'approvedAt') {
          const formatted = formatDateTimeForMySQL(value);
          if (!formatted) {
            throw new Error('Invalid scheduled date');
          }
          normalizedValue = formatted;
        }
        if (key === 'warrantyUntil' || key === 'nextMaintenanceDate') normalizedValue = this.formatDateOnly(value) || null;
        fields.push(`${snakeKey} = ?`);
        values.push(normalizedValue);
      }
    });

    // Reopening a cancelled/rejected maintenance (cancelled -> scheduled) should not
    // keep showing the previous rejection reason once it is back in an active stage.
    const shouldClearCancellationReason =
      currentStatus === 'cancelled' &&
      data.status !== undefined &&
      data.status !== 'cancelled' &&
      data.cancellationReason === undefined;
    if (shouldClearCancellationReason) {
      fields.push('cancellation_reason = NULL');
    }

    const shouldAutoAdjustDueAt =
      data.dueAt === undefined &&
      (data.scheduledDate !== undefined || data.priority !== undefined);
    if (shouldAutoAdjustDueAt) {
      const effectivePriority = data.priority ?? existingMaintenance.priority ?? existingMaintenance.priority_value ?? 'normal';
      const effectiveScheduledDate = formatDateTimeForMySQL(nextScheduledDate);
      if (effectiveScheduledDate) {
        const computedDueAt = this.buildAutomaticDueAt(effectiveScheduledDate, effectivePriority);
        if (computedDueAt) {
          fields.push('due_at = ?');
          values.push(computedDueAt);
        }
      }
    }

    if (fields.length === 0) {
      return { success: false, message: 'No fields to update' };
    }

    if (data.status === 'in_progress' && currentStatus === 'completed') {
      fields.push('completed_date = NULL');
      fields.push('completed_by = NULL');
    }
    if (data.status === 'in_progress' && currentStatus !== 'in_progress') {
      fields.push('started_at = COALESCE(started_at, NOW())');
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    await pool.query(`UPDATE maintenance_records SET ${fields.join(', ')} WHERE id = ?`, values);

    if (data.status !== undefined && data.status !== currentStatus) {
      await this.recordStatusLog(id, currentStatus || null, data.status, changedBy, data.notes || data.cancellationReason);
    }

    if (
      existingAssetId &&
      nextAssetId &&
      (existingAssetId !== nextAssetId || existingAssetType !== nextAssetType)
    ) {
      await this.syncAssetAvailability(
        existingAssetId,
        existingAssetType,
        'cancelled',
        id,
        existingDetailId,
        existingDetailCode
      );
    }

    if (nextAssetId) {
      await this.syncAssetAvailability(
        nextAssetId,
        nextAssetType,
        nextStatus,
        id,
        nextDetailId,
        nextDetailCode
      );
      await this.syncAssetDetailMaintenance(nextAssetId, nextAssetType, nextStatus, {
        detailId: nextDetailId,
        detailCode: nextDetailCode,
        completedAt: existingMaintenance.completedDate ?? existingMaintenance.completed_date,
        scheduledAt: nextScheduledDate,
        maintenanceType: nextMaintenanceType,
        cancellationReason: nextCancellationReason
      });
    }

    try {
      if (nextStatus === 'validated') {
        const validatorId = this.normalizeAssetId((data as any).validatedBy);
        const validatedAt = (data as any).validatedAt ?? new Date();
        if (validatorId) {
          await MaintenanceHistoryService.validateByMaintenanceId(
            Number(id),
            validatorId,
            validatedAt
          );
        }
      } else {
        await MaintenanceHistoryService.completeByMaintenanceId(Number(id), {
          status: nextStatus,
          completedDate:
            nextStatus === 'completed'
              ? existingMaintenance.completedDate ?? existingMaintenance.completed_date ?? new Date()
              : undefined,
          notes: data.notes,
          technician: data.technician,
          cost: data.cost
        });
      }
    } catch (historyError) {
      console.error('Error syncing maintenance history update:', historyError);
    }

    if (
      existingAssetId &&
      (existingAssetId !== nextAssetId ||
        existingAssetType !== nextAssetType ||
        existingDetailId !== nextDetailId ||
        existingDetailCode !== nextDetailCode)
    ) {
      await this.syncAssetDetailMaintenance(existingAssetId, existingAssetType, 'cancelled', {
        detailId: existingDetailId,
        detailCode: existingDetailCode
      });
    }

    const [rows] = await pool.query<MaintenanceRow[]>(
      'SELECT * FROM maintenance_records WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (nextStatus && currentStatus !== nextStatus && shouldSendMaintenancePhoneNotification(nextStatus)) {
      await this.notifyMaintenancePhone({
        userId: existingMaintenance.createdBy ?? existingMaintenance.created_by,
        action: nextStatus,
        maintenanceCode: rows[0]?.maintenanceCode || rows[0]?.maintenance_code || existingMaintenance.maintenanceCode || existingMaintenance.maintenance_code,
        assetName: rows[0]?.assetName || rows[0]?.asset_name || existingMaintenance.assetName || existingMaintenance.asset_name,
        status: rows[0]?.status || nextStatus,
        scheduledDate: rows[0]?.scheduledDate || rows[0]?.scheduled_date || nextScheduledDate,
      });
    }

    return {
      success: true,
      message: 'Maintenance record updated successfully',
      data: this.mapMaintenancePresentation(rows[0])
    };
  }

  async complete(id: string, data: CompleteMaintenanceDTO): Promise<ApiResponse<Maintenance>> {
    const maintenance = await this.getById(id);
    if (!maintenance.success) return maintenance;

    const maintenanceData = maintenance.data as unknown as Record<string, any>;
    const currentStatus = maintenanceData.status;
    if (currentStatus === 'validated') {
      return {
        success: false,
        message: 'Pemeliharaan yang sudah selesai final tidak dapat diajukan validasi ulang'
      };
    }

    if (currentStatus === 'cancelled') {
      return {
        success: false,
        message: 'Pemeliharaan yang ditolak atau dibatalkan tidak dapat ditandai selesai perbaikan'
      };
    }

    if (currentStatus !== 'in_progress') {
      return {
        success: false,
        message: 'Pemeliharaan hanya dapat ditandai selesai perbaikan setelah status diproses'
      };
    }

    const executionFieldValues: Record<string, string> = {
      diagnosis: String(maintenanceData.diagnosis || '').trim(),
      actionTaken: String(maintenanceData.actionTaken ?? maintenanceData.action_taken ?? '').trim(),
      checklist: String(maintenanceData.checklist || '').trim(),
      spareParts: String(maintenanceData.spareParts ?? maintenanceData.spare_parts ?? '').trim(),
    };
    const executionFieldLabels: Record<string, string> = {
      diagnosis: 'Diagnosis',
      actionTaken: 'Tindakan yang dilakukan',
      checklist: 'Checklist pekerjaan',
      spareParts: 'Suku cadang',
    };
    const executionRequiredFieldsByType: Record<string, string[]> = {
      preventive: ['checklist'],
      corrective: ['diagnosis', 'actionTaken', 'spareParts'],
      calibration: ['actionTaken'],
      inspection: ['checklist'],
    };
    const serviceType = String(maintenanceData.type ?? maintenanceData.maintenance_type ?? 'preventive');
    const requiredExecutionFields = executionRequiredFieldsByType[serviceType] || executionRequiredFieldsByType.preventive;
    const missingExecutionLabels = requiredExecutionFields
      .filter((field) => !executionFieldValues[field])
      .map((field) => executionFieldLabels[field]);
    if (missingExecutionLabels.length > 0) {
      return {
        success: false,
        message: `${missingExecutionLabels.join(', ')} wajib lengkap sebelum tindakan diselesaikan`
      };
    }

    const assetId = this.normalizeAssetId(
      maintenanceData.assetId ?? maintenanceData.asset_id
    );
    const assetType = this.normalizeAssetType(
      maintenanceData.assetType ?? maintenanceData.asset_type
    );
    const maintenanceType = maintenanceData.type ?? maintenanceData.maintenance_type;

    await pool.query(
      `UPDATE maintenance_records 
       SET status = 'completed',
           completed_date = NOW(),
           actual_start_at = COALESCE(actual_start_at, started_at, NOW()),
           actual_end_at = COALESCE(actual_end_at, NOW()),
           notes = COALESCE(?, notes),
           cost = COALESCE(?, cost),
           completed_by = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [data.notes || null, data.cost || null, data.completedBy, id]
    );
    await this.recordStatusLog(id, currentStatus, 'completed', data.completedBy, data.notes);

    try {
      await MaintenanceHistoryService.completeByMaintenanceId(Number(id), {
        status: 'completed',
        completedDate: new Date(),
        notes: data.notes,
        cost: data.cost,
      });
    } catch (historyError) {
      console.error('Error syncing maintenance history completion:', historyError);
    }

    if (assetId) {
      await this.syncAssetAvailability(
        assetId,
        assetType,
        'completed',
        id,
        this.normalizeDetailIdentifier(maintenanceData.assetDetailId ?? maintenanceData.asset_detail_id),
        this.normalizeDetailIdentifier(maintenanceData.assetDetailCode ?? maintenanceData.asset_detail_code)
      );
      await this.syncAssetDetailMaintenance(assetId, assetType, 'completed', {
        detailId: this.normalizeDetailIdentifier(
          maintenanceData.assetDetailId ?? maintenanceData.asset_detail_id
        ),
        detailCode: this.normalizeDetailIdentifier(
          maintenanceData.assetDetailCode ?? maintenanceData.asset_detail_code
        ),
        completedAt: new Date(),
        scheduledAt: maintenanceData.scheduledDate ?? maintenanceData.scheduled_date,
        maintenanceType: maintenanceType
      });
    }

    const updated = await this.getById(id);
    if (!updated.success) return updated;

    await this.notifyMaintenancePhone({
      userId: maintenanceData.createdBy ?? maintenanceData.created_by,
      action: 'completed',
      maintenanceCode: maintenanceData.maintenanceCode ?? maintenanceData.maintenance_code,
      assetName: maintenanceData.assetName ?? maintenanceData.asset_name,
      status: 'completed',
      scheduledDate: maintenanceData.scheduledDate ?? maintenanceData.scheduled_date,
    });

    return {
      ...updated,
      message: 'Pemeliharaan selesai diperbaiki dan menunggu validasi akhir'
    };
  }

  async validate(id: string, validatedBy: number, validatedAt: Date | string = new Date()): Promise<ApiResponse<Maintenance>> {
    const existing = await this.getById(id);
    if (!existing.success) return existing;

    const maintenanceData = existing.data as unknown as Record<string, any>;
    const currentStatus = maintenanceData.status;

    if (currentStatus === 'validated') {
      return {
        success: false,
        message: 'Pemeliharaan ini sudah selesai final'
      };
    }

    if (currentStatus !== 'completed') {
      return {
        success: false,
        message: 'Validasi akhir hanya dapat dilakukan saat status menunggu validasi'
      };
    }

    const verificationFieldValues: Record<string, string> = {
      finalCondition: String(maintenanceData.finalCondition ?? maintenanceData.final_condition ?? '').trim(),
      verificationResult: String(maintenanceData.verificationResult ?? maintenanceData.verification_result ?? '').trim(),
    };
    const verificationFieldLabels: Record<string, string> = {
      finalCondition: 'Kondisi akhir',
      verificationResult: 'Hasil pengujian',
    };
    const verificationRequiredFieldsByType: Record<string, string[]> = {
      calibration: ['verificationResult'],
    };
    const validationServiceType = String(maintenanceData.type ?? maintenanceData.maintenance_type ?? 'preventive');
    const requiredVerificationFields = ['finalCondition', ...(verificationRequiredFieldsByType[validationServiceType] || [])];
    const missingVerificationLabels = requiredVerificationFields
      .filter((field) => !verificationFieldValues[field])
      .map((field) => verificationFieldLabels[field]);
    if (missingVerificationLabels.length > 0) {
      return {
        success: false,
        message: `${missingVerificationLabels.join(' dan ')} wajib diisi sebelum validasi final`
      };
    }

    await pool.query(
      `UPDATE maintenance_records
       SET status = 'validated', validated_by = ?, validated_at = ?, updated_at = NOW()
       WHERE id = ?`,
      [validatedBy, formatDateTimeForMySQL(validatedAt), id]
    );
    await this.recordStatusLog(id, currentStatus, 'validated', validatedBy, 'Validasi akhir');

    try {
      await MaintenanceHistoryService.validateByMaintenanceId(Number(id), validatedBy, validatedAt);
    } catch (historyError) {
      console.error('Error syncing maintenance history validation:', historyError);
    }

    const assetId = this.normalizeAssetId(
      maintenanceData.assetId ?? maintenanceData.asset_id
    );
    const assetType = this.normalizeAssetType(
      maintenanceData.assetType ?? maintenanceData.asset_type
    );
    const maintenanceType = maintenanceData.type ?? maintenanceData.maintenance_type;

    if (assetId) {
      await this.syncAssetAvailability(
        assetId,
        assetType,
        'validated',
        id,
        this.normalizeDetailIdentifier(maintenanceData.assetDetailId ?? maintenanceData.asset_detail_id),
        this.normalizeDetailIdentifier(maintenanceData.assetDetailCode ?? maintenanceData.asset_detail_code)
      );
      await this.syncAssetDetailMaintenance(assetId, assetType, 'validated', {
        detailId: this.normalizeDetailIdentifier(
          maintenanceData.assetDetailId ?? maintenanceData.asset_detail_id
        ),
        detailCode: this.normalizeDetailIdentifier(
          maintenanceData.assetDetailCode ?? maintenanceData.asset_detail_code
        ),
        completedAt: maintenanceData.completedDate ?? maintenanceData.completed_date ?? validatedAt,
        scheduledAt: maintenanceData.scheduledDate ?? maintenanceData.scheduled_date,
        maintenanceType
      });
    }

    try {
      await this.createNextRecurringMaintenance(maintenanceData, validatedBy);
    } catch (recurringError) {
      console.error('Error creating next recurring maintenance:', recurringError);
    }

    const updated = await this.getById(id);
    if (!updated.success) return updated;

    await this.notifyMaintenancePhone({
      userId: maintenanceData.createdBy ?? maintenanceData.created_by,
      action: 'validated',
      maintenanceCode: maintenanceData.maintenanceCode ?? maintenanceData.maintenance_code,
      assetName: maintenanceData.assetName ?? maintenanceData.asset_name,
      status: 'validated',
      scheduledDate: maintenanceData.scheduledDate ?? maintenanceData.scheduled_date,
    });

    return {
      ...updated,
      message: 'Pemeliharaan selesai final setelah lolos validasi akhir'
    };
  }

  async addAttachment(data: {
    maintenanceId: number;
    fileName: string;
    filePath: string;
    mimeType?: string | null;
    uploadedBy?: number | null;
  }): Promise<ApiResponse<Record<string, any>>> {
    const existing = await this.getById(String(data.maintenanceId));
    if (!existing.success) return { success: false, message: 'Maintenance record not found' };

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO maintenance_attachments (maintenance_id, file_name, file_path, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [data.maintenanceId, data.fileName, data.filePath, data.mimeType ?? null, data.uploadedBy ?? null]
    );

    const [rows] = await pool.query<MaintenanceAttachmentRow[]>(
      'SELECT * FROM maintenance_attachments WHERE id = ?',
      [result.insertId]
    );
    const row = rows[0];
    return {
      success: true,
      message: 'Lampiran pemeliharaan berhasil diunggah',
      data: {
        id: row.id,
        maintenanceId: row.maintenance_id,
        fileName: row.file_name,
        filePath: row.file_path,
        mimeType: row.mime_type,
        uploadedBy: row.uploaded_by,
        createdAt: row.created_at,
        url: row.file_path,
      }
    };
  }

  async getAttachments(maintenanceId: number): Promise<ApiResponse<Record<string, any>[]>> {
    const [rows] = await pool.query<MaintenanceAttachmentRow[]>(
      `SELECT * FROM maintenance_attachments
       WHERE maintenance_id = ?
       ORDER BY created_at DESC`,
      [maintenanceId]
    );
    return {
      success: true,
      message: 'Lampiran pemeliharaan berhasil dimuat',
      data: rows.map((row) => ({
        id: row.id,
        maintenanceId: row.maintenance_id,
        fileName: row.file_name,
        filePath: row.file_path,
        mimeType: row.mime_type,
        uploadedBy: row.uploaded_by,
        createdAt: row.created_at,
        url: row.file_path,
      }))
    };
  }

  async dispatchDueReminders(): Promise<ApiResponse<{ sent: number }>> {
    const [rows] = await pool.query<MaintenanceRow[]>(`
      SELECT *, DATEDIFF(DATE(scheduled_date), CURDATE()) AS days_remaining
      FROM maintenance_records
      WHERE deleted_at IS NULL
        AND status NOT IN ('validated', 'cancelled')
        AND scheduled_date IS NOT NULL
        AND DATEDIFF(DATE(scheduled_date), CURDATE()) IN (7, 3, 1)
        AND (
          (DATEDIFF(DATE(scheduled_date), CURDATE()) = 7 AND reminder_h7_sent_at IS NULL) OR
          (DATEDIFF(DATE(scheduled_date), CURDATE()) = 3 AND reminder_h3_sent_at IS NULL) OR
          (DATEDIFF(DATE(scheduled_date), CURDATE()) = 1 AND reminder_h1_sent_at IS NULL)
        )
    `);

    let sent = 0;
    for (const row of rows) {
      const days = Number((row as any).days_remaining);
      const reminderColumn = days === 7 ? 'reminder_h7_sent_at' : days === 3 ? 'reminder_h3_sent_at' : 'reminder_h1_sent_at';
      const recipients = await this.getMaintenanceReminderRecipients(row);
      if (recipients.length > 0) {
        await notificationService.createForUsers(recipients, {
          type: `maintenance_reminder_h${days}`,
          category: 'maintenance',
          title: `Pengingat H-${days} pemeliharaan`,
          message: `${row.assetDetailName || row.assetName || 'Aset'} ${row.maintenanceCode || ''} dijadwalkan pada ${this.formatDateOnly(row.scheduledDate ?? (row as any).scheduled_date) || '-'}`,
          link: '/maintenance',
          referenceType: 'maintenance',
          referenceId: Number(row.id),
        });
      }
      await pool.query(`UPDATE maintenance_records SET ${reminderColumn} = NOW() WHERE id = ?`, [row.id]);
      sent += recipients.length;
    }

    return { success: true, message: 'Reminder pemeliharaan diproses', data: { sent } };
  }

  private async getMaintenanceReminderRecipients(row: MaintenanceRow): Promise<number[]> {
    const recipients = [
      this.normalizeAssetId((row as any).created_by ?? row.createdBy),
      this.normalizeAssetId((row as any).technician_user_id ?? row.technicianUserId),
      this.normalizeAssetId((row as any).completed_by ?? row.completedBy),
    ].filter((id): id is number => Boolean(id));

    const [users] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM users WHERE role IN ('admin', 'leader') AND deleted_at IS NULL`
    );
    users.forEach((user) => {
      const id = this.normalizeAssetId(user.id);
      if (id) recipients.push(id);
    });
    return Array.from(new Set(recipients));
  }

  async getAnalytics(): Promise<ApiResponse<Record<string, any>>> {
    const [summaryRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'requested') AS requested,
        SUM(status = 'scheduled') AS scheduled,
        SUM(status = 'in_progress') AS in_progress,
        SUM(status = 'completed') AS completed,
        SUM(status = 'validated') AS validated,
        SUM(status = 'cancelled') AS cancelled,
        SUM(status NOT IN ('validated','cancelled') AND scheduled_date < NOW()) AS overdue,
        COALESCE(SUM(cost), 0) AS total_cost,
        COALESCE(SUM(estimated_cost), 0) AS total_estimated_cost,
        AVG(TIMESTAMPDIFF(HOUR, COALESCE(actual_start_at, started_at, scheduled_date), COALESCE(actual_end_at, completed_date, updated_at))) AS avg_downtime_hours
      FROM maintenance_records
      WHERE deleted_at IS NULL
    `);
    const [frequentAssets] = await pool.query<RowDataPacket[]>(`
      SELECT asset_id, COALESCE(asset_detail_name, asset_detail_code, asset_id) AS asset_name, COUNT(*) AS total
      FROM maintenance_records
      WHERE deleted_at IS NULL
      GROUP BY asset_id, COALESCE(asset_detail_name, asset_detail_code, asset_id)
      ORDER BY total DESC
      LIMIT 8
    `);
    const [technicians] = await pool.query<RowDataPacket[]>(`
      SELECT COALESCE(technician, 'Belum ditugaskan') AS technician, COUNT(*) AS total,
        SUM(status = 'validated') AS completed
      FROM maintenance_records
      WHERE deleted_at IS NULL
      GROUP BY COALESCE(technician, 'Belum ditugaskan')
      ORDER BY total DESC
      LIMIT 8
    `);

    return {
      success: true,
      message: 'Dashboard pemeliharaan berhasil dimuat',
      data: {
        summary: summaryRows[0] || {},
        frequentAssets,
        technicians,
      }
    };
  }

  async delete(id: string, deletedBy?: number, deleteReason?: string): Promise<ApiResponse> {
    const existing = await this.getById(id);
    if (!existing.success || !existing.data) {
      return { success: false, message: 'Maintenance record not found' };
    }

    const existingMaintenance = existing.data as unknown as Record<string, any>;
    const existingAssetId = this.normalizeAssetId(
      existingMaintenance.assetId ?? existingMaintenance.asset_id
    );
    const existingAssetType = this.normalizeAssetType(
      existingMaintenance.assetType ?? existingMaintenance.asset_type
    );
    const existingStatus = existingMaintenance.status as string | undefined;
    const existingDetailId = this.normalizeDetailIdentifier(
      existingMaintenance.assetDetailId ?? existingMaintenance.asset_detail_id
    );
    const existingDetailCode = this.normalizeDetailIdentifier(
      existingMaintenance.assetDetailCode ?? existingMaintenance.asset_detail_code
    );

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE maintenance_records
       SET deleted_at = NOW(),
           deleted_by = ?,
           delete_reason = ?,
           updated_at = NOW()
       WHERE id = ?
         AND deleted_at IS NULL`,
      [deletedBy ?? null, deleteReason?.trim() || null, id]
    );

    if (result.affectedRows === 0) {
      return { success: false, message: 'Maintenance record not found' };
    }

    await MaintenanceHistoryService.removeByMaintenanceId(Number(id), deletedBy, deleteReason);

    if (existingAssetId) {
      await this.syncAssetAvailability(
        existingAssetId,
        existingAssetType,
        'cancelled',
        id,
        existingDetailId,
        existingDetailCode
      );

      if (existingStatus) {
        await this.syncAssetDetailMaintenance(existingAssetId, existingAssetType, 'cancelled', {
          detailId: existingDetailId,
          detailCode: existingDetailCode
        });
      }
    }

    return { success: true, message: 'Riwayat pemeliharaan diarsipkan' };
  }
}

export default new MaintenanceService();
