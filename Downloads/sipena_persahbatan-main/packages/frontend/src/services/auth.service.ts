import { getCurrentUser as getLocalUser, initializeDefaultAdmin, login as localLogin, logout as localLogout, register as localRegister, setCurrentUser, clearAuthSession } from './auth-utils';
import apiService, { API_BASE_URL } from './api.service';
import type { StaffAccessType, UserRole } from "@/types/auth-types";

const API_HEALTH_URL = `${API_BASE_URL}/health`;
const ENABLE_LOCAL_FALLBACK = process.env.NEXT_PUBLIC_ENABLE_LOCAL_FALLBACK === 'true';

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
  role?: string;
  staffAccessType?: string;
}

export interface User {
  id: number | string;
  nip: string;
  name: string;
  email: string;
  role: UserRole;
  staffAccessType?: StaffAccessType;
  gender?: string;
  workUnit?: string;
  homeAddress?: string;
  photoPath?: string;
  createdAt?: string;
  lastLogin?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    token: string;
  };
}

export interface ProfileUpdatePayload {
  nip?: string;
  name?: string;
  email?: string;
  gender?: string;
  workUnit?: string;
  homeAddress?: string;
  photo?: File | null;
}

// Check if backend is available
async function isBackendAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
    
    const response = await fetch(API_HEALTH_URL, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

class AuthService {
  private useLocalStorage: boolean = false;

  constructor() {
    // Initialize default admin on startup
    if (typeof window !== 'undefined' && ENABLE_LOCAL_FALLBACK) {
      initializeDefaultAdmin();
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    // Try backend first
    try {
      const backendAvailable = await isBackendAvailable();
      
      if (backendAvailable) {
        const response = await apiService.post<AuthResponse>('/auth/login', credentials);
        
        if (response.success && response.data?.token) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          this.useLocalStorage = false;
        }
        
        return response;
      }
      if (!ENABLE_LOCAL_FALLBACK) {
        return { success: false, message: 'Backend tidak tersedia. Pastikan server API berjalan.' };
      }
    } catch (error) {
      if (!ENABLE_LOCAL_FALLBACK) {
        return { success: false, message: 'Backend tidak tersedia. Pastikan server API berjalan.' };
      }
      console.log('Backend not available, using localStorage fallback');
    }

    // Fallback to localStorage
    this.useLocalStorage = true;
    const result = localLogin(credentials);
    
    if (result.success && result.user) {
      localStorage.setItem('user', JSON.stringify(result.user));
      localStorage.setItem('token', 'local_token_' + Date.now());
      return {
        success: true,
        message: result.message,
        data: {
          user: result.user as unknown as User,
          token: 'local_token'
        }
      };
    }
    
    return {
      success: false,
      message: result.message
    };
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    // Try backend first
    try {
      const backendAvailable = await isBackendAvailable();
      
      if (backendAvailable) {
        return apiService.post<AuthResponse>('/auth/register', credentials);
      }
      if (!ENABLE_LOCAL_FALLBACK) {
        return { success: false, message: 'Backend tidak tersedia. Pastikan server API berjalan.' };
      }
    } catch (error) {
      if (!ENABLE_LOCAL_FALLBACK) {
        return { success: false, message: 'Backend tidak tersedia. Pastikan server API berjalan.' };
      }
      console.log('Backend not available, using localStorage fallback');
    }

    // Fallback to localStorage
    const result = localRegister({
      nip: credentials.nip,
      name: credentials.name,
      email: credentials.email,
      password: credentials.password,
      confirmPassword: credentials.confirmPassword,
      role: (credentials.role as any) || 'staff',
      staffAccessType: credentials.staffAccessType as any
    });
    
    return {
      success: result.success,
      message: result.message,
      data: result.user ? {
        user: result.user as unknown as User,
        token: ''
      } : undefined
    };
  }

  async logout(): Promise<void> {
    try {
      if (!this.useLocalStorage) {
        await apiService.post('/auth/logout', {});
      }
    } catch (error) {
      // Ignore logout API errors
    } finally {
      localLogout();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }

  async getProfile(): Promise<AuthResponse> {
    if (this.useLocalStorage) {
      const user = getLocalUser();
      if (user) {
        return {
          success: true,
          message: 'Profile retrieved',
          data: {
            user: user as unknown as User,
            token: localStorage.getItem('token') || ''
          }
        };
      }
      return { success: false, message: 'Not authenticated' };
    }

    const token = this.getToken();
    if (!token) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const response = await apiService.get<AuthResponse>('/auth/me');
      if (response.success && response.data?.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setCurrentUser(response.data.user);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-user-updated'));
        }
      }
      return response;
    } catch (error: any) {
      const status = error?.response?.status;
      const responseBody = error?.response?.body;
      const serverMessage =
        responseBody?.message ||
        (typeof responseBody === 'string' ? responseBody : undefined);
      const errorMessage = serverMessage || error?.message || 'Gagal memuat profil';

      if (status === 401 || status === 404) {
        this.clearInvalidSession();
        return { success: false, message: errorMessage };
      }

      throw error;
    }
  }

  async updateProfile(payload: ProfileUpdatePayload): Promise<AuthResponse> {
    if (this.useLocalStorage) {
      const user = getLocalUser();
      if (!user) {
        return { success: false, message: 'Not authenticated' };
      }

      const updatedUser = {
        ...user,
        ...{
          nip: payload.nip ?? user.nip,
          name: payload.name ?? user.name,
          email: payload.email ?? user.email,
          gender: payload.gender ?? (user as User).gender,
          workUnit: payload.workUnit ?? (user as User).workUnit,
          homeAddress: payload.homeAddress ?? (user as User).homeAddress
        }
      };

      localStorage.setItem('user', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser as User);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-user-updated'));
      }

      return {
        success: true,
        message: 'Profil berhasil diperbarui',
        data: {
          user: updatedUser as User,
          token: localStorage.getItem('token') || ''
        }
      };
    }

    const formData = new FormData();

    if (payload.nip !== undefined) formData.append('nip', payload.nip);
    if (payload.name !== undefined) formData.append('name', payload.name);
    if (payload.email !== undefined) formData.append('email', payload.email);
    if (payload.gender !== undefined) formData.append('gender', payload.gender);
    if (payload.workUnit !== undefined) formData.append('workUnit', payload.workUnit);
    if (payload.homeAddress !== undefined) formData.append('homeAddress', payload.homeAddress);
    if (payload.photo) formData.append('photo', payload.photo);

    const response = await apiService.patch<AuthResponse>('/auth/me', formData);

    if (response.success && response.data?.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setCurrentUser(response.data.user);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-user-updated'));
      }
    }

    return response;
  }

  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('token');
    if (!token) return null;

    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  }

  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('token') && !!localStorage.getItem('user');
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  private clearInvalidSession(): void {
    if (typeof window === 'undefined') return;
    clearAuthSession();
  }
}

export const authService = new AuthService();
export default authService;
