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
  borrowDate: string;
  dueDate?: string | null;
  returnDate?: string;
  status: BorrowingStatus;
  purpose: string;
  notes?: string;
  approvedBy?: number;
  approvedAt?: string;
  rejectedBy?: number;
  rejectedAt?: string;
  rejectionReason?: string;
  returnCondition?: string;
  returnNotes?: string;
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
  purpose: string;
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
