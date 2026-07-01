import apiService from './api.service';

export type DisposalStatus = 'pending' | 'approved' | 'rejected';

export interface AssetDisposalRequest {
  id: number;
  requestCode?: string;
  assetId: number;
  assetType: 'medical' | 'non_medical';
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  reason: string;
  conditionNotes?: string;
  status: DisposalStatus;
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

class AssetDisposalService {
  async getAll(params: { status?: string; assetType?: string; page?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.assetType) q.set('assetType', params.assetType);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    return apiService.get<{ success: boolean; data: { data: AssetDisposalRequest[]; total: number } }>(
      `/asset-disposal?${q.toString()}`
    );
  }

  async create(data: {
    assetId: number;
    assetType: 'medical' | 'non_medical';
    assetDetailId?: string;
    assetDetailName?: string;
    assetDetailCode?: string;
    reason: string;
    conditionNotes?: string;
  }) {
    return apiService.post<{ success: boolean; message: string; data: AssetDisposalRequest }>(
      '/asset-disposal',
      data
    );
  }

  async approve(id: number, reviewNotes?: string) {
    return apiService.patch<{ success: boolean; message: string }>(`/asset-disposal/${id}/approve`, {
      reviewNotes,
    });
  }

  async reject(id: number, reviewNotes: string) {
    return apiService.patch<{ success: boolean; message: string }>(`/asset-disposal/${id}/reject`, {
      reviewNotes,
    });
  }

  async delete(id: number) {
    return apiService.delete<{ success: boolean; message: string }>(`/asset-disposal/${id}`);
  }
}

export const assetDisposalService = new AssetDisposalService();
export default assetDisposalService;
