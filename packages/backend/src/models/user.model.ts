export interface User {
  id: number;
  nip: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  staffAccessType?: StaffAccessType;
  gender?: string;
  workUnit?: string | null;
  subWorkUnit?: string | null;
  homeAddress?: string | null;
  phoneNumber?: string | null;
  photoPath?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date;
  umlAccess?: boolean;
}

export type UserRole = 'admin' | 'leader' | 'staff' | 'staff_pj' | 'teknisi' | 'user';

export type StaffAccessType = 'medical' | 'non_medical' | 'both' | 'medis' | 'non-medis' | 'all' | null;

export interface CreateUserDTO {
  nip: string;
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  staffAccessType?: StaffAccessType;
  gender?: string;
  workUnit?: string;
  subWorkUnit?: string;
  homeAddress?: string;
  phoneNumber?: string;
  photoPath?: string;
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  role?: UserRole;
  staffAccessType?: StaffAccessType;
  umlAccess?: boolean;
  gender?: string;
  workUnit?: string;
  subWorkUnit?: string;
  homeAddress?: string;
  phoneNumber?: string;
  photoPath?: string;
}

export interface UserFilters {
  page: number;
  limit: number;
  search?: string;
  role?: string;
}
