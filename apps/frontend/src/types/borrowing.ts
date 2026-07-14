// Borrowing types
export interface Borrowing {
  id: number;
  borrowingCode: string;
  assetId: number;
  userId: number;
  assetName?: string;
  assetCode?: string;
  userName?: string;
  userNip?: string;
  borrowerPosition?: string;
  borrowerWorkUnit?: string;
  ownerName?: string;
  ownerNip?: string;
  ownerPosition?: string;
  ownerWorkUnit?: string;
  borrowDate: string;
  dueDate?: string | null;
  returnDate?: string;
  status: BorrowingStatus;
  purpose: string;
  purposeType?: "inside_hospital" | "outside_hospital";
  destinationRoom?: string;
  loanDurationValue?: number;
  loanDurationUnit?: "day" | "month" | "year";
  quantity?: number;
  notes?: string;
  approvedBy?: number;
  approvedAt?: string;
  rejectedBy?: number;
  rejectedAt?: string;
  rejectionReason?: string;
  returnCondition?: string;
  returnNotes?: string;
  overdueDays?: number;
  sanctionStatus?: "none" | "active" | "resolved";
  sanctionNotes?: string | null;
  sanctionAppliedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type BorrowingStatus = 'pending' | 'approved' | 'rejected' | 'borrowed' | 'returned' | 'overdue';

// Borrowing filters
export interface BorrowingFilters {
  page?: number;
  limit?: number;
  status?: BorrowingStatus;
  userId?: number | string;
  assetId?: number | string;
  startDate?: string;
  endDate?: string;
}

// Borrowing form data
export interface BorrowingFormData {
  assetId: number;
  borrowDate: string;
  dueDate?: string;
  purpose: string;
  borrowerPosition?: string;
  borrowerWorkUnit?: string;
  ownerName?: string;
  ownerNip?: string;
  ownerPosition?: string;
  ownerWorkUnit?: string;
  purposeType?: "inside_hospital" | "outside_hospital";
  destinationRoom?: string;
  loanDurationValue?: number;
  loanDurationUnit?: "day" | "month" | "year";
  quantity?: number;
  notes?: string;
}

// Return form data
export interface ReturnFormData {
  condition: string;
  notes?: string;
}

// Borrowing response
export interface BorrowingResponse {
  success: boolean;
  message: string;
  data: Borrowing | Borrowing[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
