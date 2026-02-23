import { AssetType } from './asset.model';

export interface Borrowing {
  id: number;
  borrowingCode: string;
  assetId: number;
  assetType?: AssetType;
  userId: number;
  assetName?: string;
  assetCode?: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  assetLocation?: string;
  userName?: string;
  userNip?: string;
  borrowDate: Date;
  dueDate?: Date;
  returnDate?: Date;
  status: BorrowingStatus;
  purpose: string;
  notes?: string;
  approvedBy?: number;
  approvedAt?: Date;
  rejectedBy?: number;
  rejectedAt?: Date;
  rejectionReason?: string;
  returnCondition?: string;
  returnNotes?: string;
  returnValidatedBy?: number;
  returnValidatedAt?: Date;
  returnValidatorName?: string;
  returnValidatorNip?: string;
  returnedBy?: number;
  returnedByName?: string;
  returnedByNip?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type BorrowingStatus = 'pending' | 'approved' | 'rejected' | 'borrowed' | 'returned' | 'overdue';

export interface CreateBorrowingDTO {
  assetId: number;
  assetType?: AssetType;
  userId: number;
  borrowDate: Date;
  dueDate?: Date;
  purpose: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  notes?: string;
}

export interface UpdateBorrowingDTO {
  borrowDate?: Date;
  dueDate?: Date;
  purpose?: string;
  notes?: string;
  returnCondition?: string;
  returnNotes?: string;
}

export interface ReturnBorrowingDTO {
  condition: string;
  notes?: string;
  returnedBy?: number;
}

export interface BorrowingFilters {
  page: number;
  limit: number;
  status?: string;
  userId?: string;
  assetId?: string;
  assetType?: AssetType;
}
