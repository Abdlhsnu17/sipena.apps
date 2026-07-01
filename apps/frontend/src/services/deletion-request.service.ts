import apiService from './api.service';

export type DeletionRequestStatus = 'pending' | 'approved' | 'rejected';
export type DeletionTargetType = 'user' | 'borrowing' | 'return' | 'maintenance';

export interface DeletionRequest {
  id: number;
  requestCode?: string;
  targetType: DeletionTargetType;
  targetId: number;
  targetLabel?: string;
  reason: string;
  status: DeletionRequestStatus;
  requestedBy: number;
  requesterName?: string;
  requesterNip?: string;
  reviewedBy?: number;
  reviewerName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

class DeletionRequestService {
  async getAll(params: { status?: string; targetType?: string; page?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.targetType) q.set('targetType', params.targetType);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    return apiService.get<{ success: boolean; message: string; data: { data: DeletionRequest[]; total: number } }>(
      `/deletion-requests?${q.toString()}`
    );
  }

  async create(data: {
    targetType: DeletionTargetType;
    targetId: number;
    targetLabel?: string;
    reason: string;
  }) {
    return apiService.post<{ success: boolean; message: string; data: DeletionRequest }>(
      '/deletion-requests',
      data
    );
  }

  async approve(id: number, reviewNotes?: string) {
    return apiService.patch<{ success: boolean; message: string }>(`/deletion-requests/${id}/approve`, {
      reviewNotes,
    });
  }

  async reject(id: number, reviewNotes?: string) {
    return apiService.patch<{ success: boolean; message: string }>(`/deletion-requests/${id}/reject`, {
      reviewNotes,
    });
  }
}

export const deletionRequestService = new DeletionRequestService();
export default deletionRequestService;
