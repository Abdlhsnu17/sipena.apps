import { toIsoDateTimeString } from "../utils/date-input";
import apiService from './api.service';

export interface Borrowing {
  id: number;
  borrowingCode: string;
  assetId: number;
  assetType?: 'medical' | 'non_medical';
  userId: number;
  assetName?: string;
  assetCode?: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  assetLocation?: string;
  userName?: string;
  userNip?: string;
  userEmail?: string;
  borrowerRole?: string;
  borrowerPosition?: string;
  borrowerWorkUnit?: string;
  borrowerCurrentWorkUnit?: string;
  ownerUserId?: number;
  ownerName?: string;
  ownerNip?: string;
  ownerPosition?: string;
  ownerWorkUnit?: string;
  borrowDate: string;
  dueDate?: string | null;
  returnDate?: string;
  status: 'pending' | 'approved' | 'rejected' | 'borrowed' | 'returned' | 'overdue';
  purpose: string;
  purposeType?: 'inside_hospital' | 'outside_hospital';
  destinationRoom?: string;
  loanDurationValue?: number;
  loanDurationUnit?: 'day' | 'month' | 'year';
  quantity?: number;
  notes?: string;
  approvedBy?: number;
  approvedAt?: string;
  rejectedBy?: number;
  rejectedAt?: string;
  rejectionReason?: string;
  returnCondition?: string;
  returnNotes?: string;
  returnValidatedBy?: number;
  returnValidatedAt?: string;
  returnValidatorName?: string;
  returnValidatorNip?: string;
  returnedBy?: number;
  returnedByName?: string;
  returnedByNip?: string;
  overdueDays?: number;
  sanctionStatus?: 'none' | 'active' | 'resolved';
  sanctionNotes?: string | null;
  sanctionAppliedAt?: string;
  extensionCount?: number;
  lastExtendedDate?: string;
  extensionNotes?: string;
  isExtensionBlocked?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BorrowingFilters {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
  assetId?: string;
  assetType?: 'medical' | 'non_medical';
  /** Kata kunci bebas; dicocokkan server ke kode, aset, peminjam, dan catatan. */
  search?: string;
  /**
   * Hanya peminjaman yang masih mengunci inventaris: status aktif, atau
   * `returned` yang pengembaliannya belum divalidasi.
   */
  lockedOnly?: boolean;
  /** Asal aset yang ditampilkan pada filter "Sumber". */
  source?: 'medis' | 'non_medis';
}

export interface BorrowingResponse {
  success: boolean;
  message: string;
  data: Borrowing[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SingleBorrowingResponse {
  success: boolean;
  message: string;
  data?: Borrowing;
}

export interface BorrowingOwnerCandidate {
  id: number;
  nip: string;
  name: string;
  role: string;
  workUnit?: string | null;
  subWorkUnit?: string | null;
}

interface BorrowingOwnerCandidatesResponse {
  success: boolean;
  message: string;
  data: BorrowingOwnerCandidate[];
}

const normalizeBorrowing = (borrowing: any): Borrowing => ({
  id: borrowing.id,
  borrowingCode: borrowing.borrowingCode ?? borrowing.borrowing_code,
  assetId: borrowing.assetId ?? borrowing.asset_id,
  assetType: borrowing.assetType ?? borrowing.asset_type,
  userId: borrowing.userId ?? borrowing.user_id,
  assetName: borrowing.assetName ?? borrowing.asset_name,
  assetCode: borrowing.assetCode ?? borrowing.asset_code,
  assetDetailId: borrowing.assetDetailId ?? borrowing.asset_detail_id,
  assetDetailName: borrowing.assetDetailName ?? borrowing.asset_detail_name,
  assetDetailCode: borrowing.assetDetailCode ?? borrowing.asset_detail_code,
  assetLocation: borrowing.assetLocation ?? borrowing.asset_location,
  userName: borrowing.userName ?? borrowing.user_name,
  userNip: borrowing.userNip ?? borrowing.user_nip,
  userEmail: borrowing.userEmail ?? borrowing.user_email,
  borrowerRole: borrowing.borrowerRole ?? borrowing.borrower_role,
  borrowerPosition: borrowing.borrowerPosition ?? borrowing.borrower_position,
  borrowerWorkUnit: borrowing.borrowerWorkUnit ?? borrowing.borrower_work_unit,
  borrowerCurrentWorkUnit: borrowing.borrowerCurrentWorkUnit ?? borrowing.borrower_current_work_unit,
  ownerUserId: borrowing.ownerUserId ?? borrowing.owner_user_id,
  ownerName: borrowing.ownerName ?? borrowing.owner_name,
  ownerNip: borrowing.ownerNip ?? borrowing.owner_nip,
  ownerPosition: borrowing.ownerPosition ?? borrowing.owner_position,
  ownerWorkUnit: borrowing.ownerWorkUnit ?? borrowing.owner_work_unit,
  borrowDate: borrowing.borrowDate ?? borrowing.borrow_date,
  dueDate: borrowing.dueDate ?? borrowing.due_date ?? null,
  returnDate: borrowing.returnDate ?? borrowing.return_date,
  status: borrowing.status,
  purpose: borrowing.purpose,
  purposeType: borrowing.purposeType ?? borrowing.purpose_type,
  destinationRoom: borrowing.destinationRoom ?? borrowing.destination_room,
  loanDurationValue: borrowing.loanDurationValue ?? borrowing.loan_duration_value,
  loanDurationUnit: borrowing.loanDurationUnit ?? borrowing.loan_duration_unit,
  quantity: borrowing.quantity,
  notes: borrowing.notes,
  approvedBy: borrowing.approvedBy ?? borrowing.approved_by,
  approvedAt: borrowing.approvedAt ?? borrowing.approved_at,
  rejectedBy: borrowing.rejectedBy ?? borrowing.rejected_by,
  rejectedAt: borrowing.rejectedAt ?? borrowing.rejected_at,
  rejectionReason: borrowing.rejectionReason ?? borrowing.rejection_reason,
  returnCondition: borrowing.returnCondition ?? borrowing.return_condition,
  returnNotes: borrowing.returnNotes ?? borrowing.return_notes,
  returnValidatedBy: borrowing.returnValidatedBy ?? borrowing.return_validated_by,
  returnValidatedAt: borrowing.returnValidatedAt ?? borrowing.return_validated_at,
  returnValidatorName: borrowing.returnValidatorName ?? borrowing.return_validator_name,
  returnValidatorNip: borrowing.returnValidatorNip ?? borrowing.return_validator_nip,
  returnedBy: borrowing.returnedBy ?? borrowing.returned_by,
  returnedByName: borrowing.returnedByName ?? borrowing.returned_by_name,
  returnedByNip: borrowing.returnedByNip ?? borrowing.returned_by_nip,
  overdueDays: borrowing.overdueDays ?? borrowing.overdue_days,
  sanctionStatus: borrowing.sanctionStatus ?? borrowing.sanction_status,
  sanctionNotes: borrowing.sanctionNotes ?? borrowing.sanction_notes,
  sanctionAppliedAt: borrowing.sanctionAppliedAt ?? borrowing.sanction_applied_at,
  extensionCount: borrowing.extensionCount ?? borrowing.extension_count,
  lastExtendedDate: borrowing.lastExtendedDate ?? borrowing.last_extended_date,
  extensionNotes: borrowing.extensionNotes ?? borrowing.extension_notes,
  isExtensionBlocked: borrowing.isExtensionBlocked ?? borrowing.is_extension_blocked,
  createdAt: borrowing.createdAt ?? borrowing.created_at,
  updatedAt: borrowing.updatedAt ?? borrowing.updated_at,
});

const emitNotificationsRefresh = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('notifications-refresh'));
};

export interface CreateBorrowingData {
  assetId: number;
  assetType?: 'medical' | 'non_medical';
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  borrowDate: string;
  dueDate?: string;
  purpose: string;
  borrowerPosition?: string;
  borrowerWorkUnit?: string;
  ownerUserId?: number;
  ownerName?: string;
  ownerNip?: string;
  ownerPosition?: string;
  ownerWorkUnit?: string;
  purposeType?: 'inside_hospital' | 'outside_hospital';
  destinationRoom?: string;
  loanDurationValue?: number;
  loanDurationUnit?: 'day' | 'month' | 'year';
  quantity?: number;
  notes?: string;
}

export interface UpdateBorrowingData {
  borrowDate?: string;
  dueDate?: string;
  purpose?: string;
  borrowerPosition?: string;
  borrowerWorkUnit?: string;
  ownerUserId?: number;
  ownerName?: string;
  ownerNip?: string;
  ownerPosition?: string;
  ownerWorkUnit?: string;
  purposeType?: 'inside_hospital' | 'outside_hospital';
  destinationRoom?: string;
  loanDurationValue?: number;
  loanDurationUnit?: 'day' | 'month' | 'year';
  quantity?: number;
  notes?: string;
  returnCondition?: string;
  returnNotes?: string;
}

class BorrowingService {
  private normalizeWritePayload(data: CreateBorrowingData | UpdateBorrowingData) {
    return {
      ...data,
      borrowDate: data.borrowDate ? toIsoDateTimeString(data.borrowDate) : undefined,
      dueDate: data.dueDate ? toIsoDateTimeString(data.dueDate) : undefined,
    };
  }

  async getOwnerCandidates(search = '', limit = 20): Promise<BorrowingOwnerCandidatesResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (search.trim()) params.set('search', search.trim());
    return apiService.get<BorrowingOwnerCandidatesResponse>(`/borrowing/owner-candidates?${params.toString()}`);
  }

  async getAll(filters: BorrowingFilters = {}): Promise<BorrowingResponse> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });

    const queryString = params.toString();
    const endpoint = `/borrowing${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiService.get<BorrowingResponse>(endpoint);
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data.map(normalizeBorrowing) : [],
    };
  }

  async getById(id: number | string): Promise<SingleBorrowingResponse> {
    const response = await apiService.get<SingleBorrowingResponse>(`/borrowing/${id}`);
    return response.data ? { ...response, data: normalizeBorrowing(response.data) } : response;
  }

  async create(data: CreateBorrowingData): Promise<SingleBorrowingResponse> {
    const response = await apiService.post<SingleBorrowingResponse>('/borrowing', this.normalizeWritePayload(data));
    const normalized = response.data ? { ...response, data: normalizeBorrowing(response.data) } : response;
    if (normalized.success) emitNotificationsRefresh();
    return normalized;
  }

  async update(id: number | string, data: UpdateBorrowingData): Promise<SingleBorrowingResponse> {
    const response = await apiService.patch<SingleBorrowingResponse>(`/borrowing/${id}`, this.normalizeWritePayload(data));
    const normalized = response.data ? { ...response, data: normalizeBorrowing(response.data) } : response;
    if (normalized.success) emitNotificationsRefresh();
    return normalized;
  }

  async approve(id: number | string): Promise<SingleBorrowingResponse> {
    const response = await apiService.patch<SingleBorrowingResponse>(`/borrowing/${id}/approve`, {});
    const normalized = response.data ? { ...response, data: normalizeBorrowing(response.data) } : response;
    if (normalized.success) emitNotificationsRefresh();
    return normalized;
  }

  async reject(id: number | string, reason: string): Promise<SingleBorrowingResponse> {
    const response = await apiService.patch<SingleBorrowingResponse>(`/borrowing/${id}/reject`, { reason });
    const normalized = response.data ? { ...response, data: normalizeBorrowing(response.data) } : response;
    if (normalized.success) emitNotificationsRefresh();
    return normalized;
  }

  async return(id: number | string, condition: string, notes?: string): Promise<SingleBorrowingResponse> {
    const response = await apiService.patch<SingleBorrowingResponse>(`/borrowing/${id}/return`, { condition, notes });
    const normalized = response.data ? { ...response, data: normalizeBorrowing(response.data) } : response;
    if (normalized.success) emitNotificationsRefresh();
    return normalized;
  }

  async validateReturn(id: number | string): Promise<SingleBorrowingResponse> {
    const response = await apiService.patch<SingleBorrowingResponse>(`/borrowing/${id}/validate-return`, {});
    const normalized = response.data ? { ...response, data: normalizeBorrowing(response.data) } : response;
    if (normalized.success) emitNotificationsRefresh();
    return normalized;
  }

  async extend(id: number | string, newDueDate: string, extensionNotes?: string): Promise<SingleBorrowingResponse> {
    const response = await apiService.patch<SingleBorrowingResponse>(`/borrowing/${id}/extend`, { 
      newDueDate: toIsoDateTimeString(newDueDate),
      extensionNotes 
    });
    const normalized = response.data ? { ...response, data: normalizeBorrowing(response.data) } : response;
    if (normalized.success) emitNotificationsRefresh();
    return normalized;
  }

  /**
   * Kunci ketersediaan inventaris dari peminjaman aktif, dihitung di server.
   * Menggantikan penurunan kunci dari seluruh daftar peminjaman di browser.
   */
  async getInventoryLocks(): Promise<{
    success: boolean;
    message: string;
    data: { assetLocks: string[]; detailLocks: string[] };
  }> {
    return apiService.get('/borrowing/locks');
  }

  async getBlockingBorrowings(userId: number | string): Promise<BorrowingResponse> {
    const response = await apiService.get<BorrowingResponse>(`/borrowing/user/${userId}/blocking`);
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data.map(normalizeBorrowing) : [],
    };
  }

  async delete(id: number | string, deleteReason?: string): Promise<{ success: boolean; message: string }> {
    const response = await apiService.delete<{ success: boolean; message: string }>(`/borrowing/${id}`, { deleteReason });
    if (response.success) emitNotificationsRefresh();
    return response;
  }

  async getMyBorrowings(filters: BorrowingFilters = {}): Promise<BorrowingResponse> {
    return this.getAll({ ...filters });
  }

  async getPendingBorrowings(): Promise<BorrowingResponse> {
    return this.getAll({ status: 'pending' });
  }
}

export const borrowingService = new BorrowingService();
export default borrowingService;
