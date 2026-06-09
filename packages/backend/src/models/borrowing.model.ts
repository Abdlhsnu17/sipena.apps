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
  userEmail?: string;
  borrowerPosition?: string;
  borrowerWorkUnit?: string;
  ownerName?: string;
  ownerPosition?: string;
  ownerWorkUnit?: string;
  borrowDate: Date;
  dueDate?: Date;
  returnDate?: Date;
  status: BorrowingStatus;
  purpose: string;
  purposeType?: BorrowingPurposeType;
  destinationRoom?: string;
  loanDurationValue?: number;
  loanDurationUnit?: BorrowingDurationUnit;
  quantity?: number;
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
  overdueDays?: number;
  sanctionStatus?: BorrowingSanctionStatus;
  sanctionNotes?: string;
  sanctionAppliedAt?: Date;
  extensionCount?: number;
  lastExtendedDate?: Date;
  extensionNotes?: string;
  isExtensionBlocked?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type BorrowingStatus = 'pending' | 'approved' | 'rejected' | 'borrowed' | 'returned' | 'overdue';
export type BorrowingSanctionStatus = 'none' | 'active' | 'resolved';
export type BorrowingPurposeType = 'inside_hospital' | 'outside_hospital';
export type BorrowingDurationUnit = 'day' | 'month' | 'year';

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
  borrowerPosition?: string;
  borrowerWorkUnit?: string;
  ownerName?: string;
  ownerPosition?: string;
  ownerWorkUnit?: string;
  purposeType?: BorrowingPurposeType;
  destinationRoom?: string;
  loanDurationValue?: number;
  loanDurationUnit?: BorrowingDurationUnit;
  quantity?: number;
  notes?: string;
}

export interface UpdateBorrowingDTO {
  borrowDate?: Date;
  dueDate?: Date;
  purpose?: string;
  borrowerPosition?: string;
  borrowerWorkUnit?: string;
  ownerName?: string;
  ownerPosition?: string;
  ownerWorkUnit?: string;
  purposeType?: BorrowingPurposeType;
  destinationRoom?: string;
  loanDurationValue?: number;
  loanDurationUnit?: BorrowingDurationUnit;
  quantity?: number;
  notes?: string;
  returnCondition?: string;
  returnNotes?: string;
}

export interface ReturnBorrowingDTO {
  condition: string;
  notes?: string;
  returnedBy?: number;
}

export interface ExtendBorrowingDTO {
  newDueDate: Date;
  extensionNotes?: string;
  extendedBy?: number;
}

export interface BorrowingFilters {
  page: number;
  limit: number;
  status?: string;
  userId?: string;
  assetId?: string;
  assetType?: AssetType;
}
