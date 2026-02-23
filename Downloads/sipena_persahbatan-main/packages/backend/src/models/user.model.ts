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
  homeAddress?: string | null;
  photoPath?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date;
  umlAccess?: boolean;
}

export type UserRole = 'admin' | 'staff' | 'user';

export type StaffAccessType = 'medical' | 'non_medical' | 'both' | null;

export interface CreateUserDTO {
  nip: string;
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  staffAccessType?: StaffAccessType;
  gender?: string;
  workUnit?: string;
  homeAddress?: string;
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
  homeAddress?: string;
  photoPath?: string;
}

export interface UserFilters {
  page: number;
  limit: number;
  search?: string;
  role?: string;
}
