import { AssetType } from './asset.model';

export type DisposalStatus = 'pending' | 'approved' | 'rejected';

export interface AssetDisposalRequest {
  id: number;
  requestCode?: string;
  assetId: number;
  assetType: AssetType;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  reason: string;
  conditionNotes?: string;
  status: DisposalStatus;
  requestedBy: number;
  requesterName?: string;
  requesterNip?: string;
  requesterEmail?: string;
  reviewedBy?: number;
  reviewerName?: string;
  reviewedAt?: Date | string;
  reviewNotes?: string;
  approvedAt?: Date | string;
  rejectedAt?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreateDisposalRequestDTO {
  assetId: number;
  assetType: AssetType;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  reason: string;
  conditionNotes?: string;
  requestedBy: number;
}

export interface ReviewDisposalRequestDTO {
  reviewNotes?: string;
  reviewedBy: number;
}
