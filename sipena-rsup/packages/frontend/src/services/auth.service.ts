import type { StaffAccessType, UserRole } from "@/types/auth-types";
import apiService, { API_BASE_URL } from './api.service';
import {
  clearAuthSession,
  getAuthToken,
  getCurrentUser as getLocalUser,
  initializeDefaultAdmin,
  login as localLogin,
  logout as localLogout,
  persistAuthSession,
  register as registerLocal,
  setCurrentUser,
} from './auth-utils';

const API_HEALTH_URL = `${API_BASE_URL}/health`;
const ENABLE_LOCAL_FALLBACK =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_FALLBACK === 'true';

export interface LoginCredentials {
  nip: string;
  password: string;
  rememberMe?: boolean;
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

export interface PasswordResetRequestResponse {
  success: boolean;
  message: string;
  data?: {
    deliveryTarget: string;
    expiresInMinutes: number;
    deliveryMethod: "local";
    verificationCode: string;
  };
}

export interface PasswordResetPayload {
  nip: string;
  verificationCode: string;
  newPassword: string;
  confirmPassword: string;
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
          persistAuthSession(response.data.user, response.data.token, credentials.rememberMe);
          this.useLocalStorage = false;
        }
        
        return response;
      }
      if (!ENABLE_LOCAL_FALLBACK) {
        return { success: false, message: 'Backend tidak tersedia. Pastikan server API berjalan.' };
      }
    } catch {
      if (!ENABLE_LOCAL_FALLBACK) {
        return { success: false, message: 'Backend tidak tersedia. Pastikan server API berjalan.' };
      }
      console.log('Backend not available, using localStorage fallback');
    }

    // Fallback to localStorage
    this.useLocalStorage = true;
    const result = localLogin(credentials);
    
    if (result.success && result.user) {
      const fallbackToken = `local_token_${Date.now()}`;
      persistAuthSession(result.user as unknown as User, fallbackToken, credentials.rememberMe);
      return {
        success: true,
        message: result.message,
        data: {
          user: result.user as unknown as User,
          token: fallbackToken
        }
      };
    }
    
    return {
      success: false,
      message: result.message
    };
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      const backendAvailable = await isBackendAvailable();

      if (backendAvailable) {
        return await apiService.post<AuthResponse>('/auth/register', credentials);
      }

      if (!ENABLE_LOCAL_FALLBACK) {
        return { success: false, message: 'Backend tidak tersedia. Pastikan server API berjalan.' };
      }
    } catch {
      if (!ENABLE_LOCAL_FALLBACK) {
        return { success: false, message: 'Backend tidak tersedia. Pastikan server API berjalan.' };
      }
    }

    this.useLocalStorage = true;
    const result = registerLocal(credentials);

    if (!result.success || !result.user) {
      return {
        success: false,
        message: result.message
      };
    }

    return {
      success: true,
      message: result.message,
      data: {
        user: result.user as unknown as User,
        token: ''
      }
    };
  }

  async requestPasswordResetCode(nip: string): Promise<PasswordResetRequestResponse> {
    return apiService.post<PasswordResetRequestResponse>('/auth/reset-password/verify', { nip });
  }

  async resetPasswordWithCode(payload: PasswordResetPayload): Promise<AuthResponse> {
    return apiService.post<AuthResponse>('/auth/reset-password', payload);
  }

  async logout(): Promise<void> {
    try {
      if (!this.useLocalStorage) {
        await apiService.post('/auth/logout', {});
      }
    } catch {
      // Ignore logout API errors
    } finally {
      localLogout();
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
            token: getAuthToken() || ''
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
        setCurrentUser(response.data.user);
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

      setCurrentUser(updatedUser as User);

      return {
        success: true,
        message: 'Profil berhasil diperbarui',
        data: {
          user: updatedUser as User,
          token: getAuthToken() || ''
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
      setCurrentUser(response.data.user);
    }

    return response;
  }

  getCurrentUser(): User | null {
    return getLocalUser() as User | null;
  }

  isAuthenticated(): boolean {
    return !!getAuthToken() && !!this.getCurrentUser();
  }

  getToken(): string | null {
    return getAuthToken();
  }

  private clearInvalidSession(): void {
    if (typeof window === 'undefined') return;
    clearAuthSession();
  }
}

export const authService = new AuthService();
export default authService;
