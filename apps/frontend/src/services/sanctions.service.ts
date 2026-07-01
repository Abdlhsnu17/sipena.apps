import apiService from './api.service';

export interface SanctionRecord {
  id: number;
  borrowingCode?: string;
  userId: number;
  userName: string;
  userNip: string;
  assetName: string;
  assetCode?: string;
  borrowDate?: string;
  dueDate?: string;
  returnDate?: string;
  overdueDays: number;
  sanctionStatus: 'none' | 'active' | 'resolved';
  sanctionNotes?: string;
  sanctionAppliedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedByUserId?: number;
  resolvedNotes?: string;
}

export interface SanctionStats {
  active: number;
  resolved: number;
  totalAffectedUsers: number;
}

export interface SanctionsListResponse {
  success: boolean;
  message: string;
  data: {
    data: SanctionRecord[];
    total: number;
  };
}

class SanctionsService {
  async getAll(params: {
    status?: 'active' | 'resolved' | 'all';
    userId?: number;
    page?: number;
    limit?: number;
  } = {}): Promise<SanctionsListResponse> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.userId) query.set('userId', String(params.userId));
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    return apiService.get(`/sanctions?${query.toString()}`);
  }

  async getStats(): Promise<{ success: boolean; data: SanctionStats }> {
    return apiService.get('/sanctions/stats');
  }

  async resolve(id: number, notes?: string): Promise<{ success: boolean; message: string }> {
    return apiService.patch(`/sanctions/${id}/resolve`, { notes });
  }

  async waive(id: number, reason: string): Promise<{ success: boolean; message: string }> {
    return apiService.patch(`/sanctions/${id}/waive`, { reason });
  }
}

export const sanctionsService = new SanctionsService();
export default sanctionsService;
