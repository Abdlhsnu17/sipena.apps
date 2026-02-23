// User types
export interface User {
  id: number | string;
  nip: string;
  name: string;
  email: string;
  role: UserRole;
  staffAccessType?: StaffAccessType;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
}

export type UserRole = 'admin' | 'leader' | 'staff' | 'user';

export type StaffAccessType =
  | 'medical'
  | 'non_medical'
  | 'both'
  | 'medis'
  | 'non-medis'
  | 'all'
  | null;

// Auth types
export interface LoginCredentials {
  nip: string;
  password: string;
}

export interface RegisterCredentials {
  nip: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role?: UserRole;
  staffAccessType?: StaffAccessType;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    token: string;
  };
  errors?: any[];
}

// Session/Auth state
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
