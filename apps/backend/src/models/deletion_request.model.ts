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
  reviewedAt?: Date | string;
  reviewNotes?: string;
  approvedAt?: Date | string;
  rejectedAt?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreateDeletionRequestDTO {
  targetType: DeletionTargetType;
  targetId: number;
  targetLabel?: string;
  reason: string;
  requestedBy: number;
}

export interface ReviewDeletionRequestDTO {
  reviewedBy: number;
  reviewNotes?: string;
}
