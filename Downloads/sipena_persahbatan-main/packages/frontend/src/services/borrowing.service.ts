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
  borrowDate: string;
  dueDate?: string | null;
  returnDate?: string;
  status: 'pending' | 'approved' | 'rejected' | 'borrowed' | 'returned' | 'overdue';
  purpose: string;
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
  borrowDate: borrowing.borrowDate ?? borrowing.borrow_date,
  dueDate: borrowing.dueDate ?? borrowing.due_date ?? null,
  returnDate: borrowing.returnDate ?? borrowing.return_date,
  status: borrowing.status,
  purpose: borrowing.purpose,
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
  createdAt: borrowing.createdAt ?? borrowing.created_at,
  updatedAt: borrowing.updatedAt ?? borrowing.updated_at,
});

export interface CreateBorrowingData {
  assetId: number;
  assetType?: 'medical' | 'non_medical';
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  borrowDate: string;
  purpose: string;
  notes?: string;
}

export interface UpdateBorrowingData {
  borrowDate?: string;
  dueDate?: string;
  purpose?: string;
  notes?: string;
  returnCondition?: string;
  returnNotes?: string;
}

class BorrowingService {
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
    const response = await apiService.post<SingleBorrowingResponse>('/borrowing', data);
    return response.data ? { ...response, data: normalizeBorrowing(response.data) } : response;
  }

  async update(id: number | string, data: UpdateBorrowingData): Promise<SingleBorrowingResponse> {
    const response = await apiService.patch<SingleBorrowingResponse>(`/borrowing/${id}`, data);
    return response.data ? { ...response, data: normalizeBorrowing(response.data) } : response;
  }

  async approve(id: number | string): Promise<SingleBorrowingResponse> {
    const response = await apiService.patch<SingleBorrowingResponse>(`/borrowing/${id}/approve`, {});
    return response.data ? { ...response, data: normalizeBorrowing(response.data) } : response;
  }

  async reject(id: number | string, reason: string): Promise<SingleBorrowingResponse> {
    const response = await apiService.patch<SingleBorrowingResponse>(`/borrowing/${id}/reject`, { reason });
    return response.data ? { ...response, data: normalizeBorrowing(response.data) } : response;
  }

  async return(id: number | string, condition: string, notes?: string): Promise<SingleBorrowingResponse> {
    const response = await apiService.patch<SingleBorrowingResponse>(`/borrowing/${id}/return`, { condition, notes });
    return response.data ? { ...response, data: normalizeBorrowing(response.data) } : response;
  }

  async validateReturn(id: number | string): Promise<SingleBorrowingResponse> {
    const response = await apiService.patch<SingleBorrowingResponse>(`/borrowing/${id}/validate-return`, {});
    return response.data ? { ...response, data: normalizeBorrowing(response.data) } : response;
  }

  async delete(id: number | string): Promise<{ success: boolean; message: string }> {
    return apiService.delete(`/borrowing/${id}`);
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
