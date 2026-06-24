import type { StaffAccessType, UserRole } from "@/types/auth-types";
import apiService, { API_BASE_URL } from './api.service';
import {
  clearAuthSession,
  getAuthToken,
  getCurrentUser as getLocalUser,
  initializeDefaultAdmin,
  isLocalAuthSession,
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
const LOGIN_SUCCESS_MESSAGE = 'Login berhasil';
const LOGIN_IDENTIFIER_REQUIRED_MESSAGE = 'Username atau email wajib diisi';
const LOGIN_PASSWORD_REQUIRED_MESSAGE = 'Password wajib diisi';
const LOGIN_RATE_LIMIT_MESSAGE = 'Terlalu banyak percobaan login. Silakan coba lagi beberapa menit.';
const LOGIN_SERVER_ISSUE_MESSAGE = 'Terjadi gangguan pada server, silakan coba lagi nanti';
const REGISTER_DUPLICATE_ACCOUNT_MESSAGE = 'Akun dengan NIP atau email ini sudah terdaftar';
const REGISTER_SERVER_ISSUE_MESSAGE = 'Terjadi gangguan pada server, silakan coba lagi nanti';
const AUTH_SESSION_INVALID_MESSAGE = 'Sesi Anda tidak valid atau sudah berakhir. Silakan login kembali.';
const AUTH_FORBIDDEN_MESSAGE = 'Anda tidak memiliki izin untuk melakukan tindakan ini.';
const AUTH_NOT_FOUND_MESSAGE = 'Data yang diminta tidak ditemukan.';
const PASSWORD_RESET_REQUEST_SERVER_ISSUE_MESSAGE = 'Gagal mengirim kode verifikasi. Silakan coba lagi nanti.';
const PASSWORD_RESET_CONFIRM_SERVER_ISSUE_MESSAGE = 'Gagal mengubah password. Silakan coba lagi nanti.';

type ApiErrorDetails = {
  responseBody: any;
  serverMessage?: string;
  status?: number;
  validationMessage?: string;
};

export interface LoginCredentials {
  nip: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  nip: string;
  name: string;
  email: string;
  phoneNumber: string;
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
  subWorkUnit?: string;
  homeAddress?: string;
  phoneNumber?: string;
  photoPath?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
  accountStatus?: "active" | "inactive" | "suspended";
  mustChangePassword?: boolean;
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
    deliveryMethod: "whatsapp" | "sms" | "local_preview";
    previewCode?: string;
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
  subWorkUnit?: string;
  homeAddress?: string;
  phoneNumber?: string;
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

function normalizeLoginError(error: any): string {
  const { serverMessage, validationMessage } = extractApiErrorDetails(error);

  if (validationMessage) {
    return validationMessage;
  }

  if (
    serverMessage === LOGIN_IDENTIFIER_REQUIRED_MESSAGE ||
    serverMessage === LOGIN_PASSWORD_REQUIRED_MESSAGE ||
    serverMessage === 'Akun tidak ditemukan' ||
    serverMessage === 'Password yang Anda masukkan salah'
  ) {
    return serverMessage;
  }

  return normalizeCommonAuthError(error, LOGIN_SERVER_ISSUE_MESSAGE);
}

function normalizeRegisterError(error: any): string {
  const { serverMessage, validationMessage } = extractApiErrorDetails(error);

  if (validationMessage) {
    return validationMessage;
  }

  if (
    serverMessage === REGISTER_DUPLICATE_ACCOUNT_MESSAGE ||
    serverMessage === 'User with this NIP or email already exists'
  ) {
    return REGISTER_DUPLICATE_ACCOUNT_MESSAGE;
  }

  return normalizeCommonAuthError(error, REGISTER_SERVER_ISSUE_MESSAGE);
}

function normalizePasswordResetRequestError(error: any): string {
  return normalizeCommonAuthError(error, PASSWORD_RESET_REQUEST_SERVER_ISSUE_MESSAGE);
}

function normalizePasswordResetConfirmError(error: any): string {
  return normalizeCommonAuthError(error, PASSWORD_RESET_CONFIRM_SERVER_ISSUE_MESSAGE);
}

function extractApiErrorDetails(error: any): ApiErrorDetails {
  const status = error?.response?.status;
  const responseBody = error?.response?.body;
  const validationErrors = Array.isArray(responseBody?.errors) ? responseBody.errors : [];
  const validationMessage = validationErrors.find((item: any) => typeof item?.msg === 'string')?.msg;
  const serverMessage =
    responseBody?.message ||
    (typeof responseBody === 'string' ? responseBody : undefined);

  return {
    status,
    responseBody,
    serverMessage,
    validationMessage,
  };
}

function isRateLimitMessage(message?: string): boolean {
  return (
    message === 'Too many requests' ||
    message === 'Too many requests from this IP, please try again later.' ||
    (typeof message === 'string' && message.toLowerCase().includes('too many requests'))
  );
}

function normalizeCommonAuthError(error: any, fallbackMessage: string): string {
  const { status, serverMessage, validationMessage } = extractApiErrorDetails(error);

  if (validationMessage) {
    return validationMessage;
  }

  if (status === 429 || isRateLimitMessage(serverMessage)) {
    return LOGIN_RATE_LIMIT_MESSAGE;
  }

  if (serverMessage === 'Unauthorized') {
    return AUTH_SESSION_INVALID_MESSAGE;
  }

  if (serverMessage === 'Not authenticated') {
    return AUTH_SESSION_INVALID_MESSAGE;
  }

  if (serverMessage === 'Session has been invalidated') {
    return AUTH_SESSION_INVALID_MESSAGE;
  }

  if (serverMessage === 'Forbidden') {
    return AUTH_FORBIDDEN_MESSAGE;
  }

  if (
    serverMessage === 'User not found' ||
    serverMessage === 'Referenced record not found' ||
    serverMessage === 'Route not found' ||
    (typeof serverMessage === 'string' && /^Route .* not found$/i.test(serverMessage))
  ) {
    return AUTH_NOT_FOUND_MESSAGE;
  }

  if (
    serverMessage === 'Internal server error' ||
    serverMessage === 'API proxy request failed' ||
    serverMessage === 'Validation failed'
  ) {
    return fallbackMessage;
  }

  if (serverMessage) {
    return serverMessage;
  }

  if (status === 401) {
    return AUTH_SESSION_INVALID_MESSAGE;
  }

  if (status === 403) {
    return AUTH_FORBIDDEN_MESSAGE;
  }

  if (status === 404) {
    return AUTH_NOT_FOUND_MESSAGE;
  }

  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return fallbackMessage;
  }

  return fallbackMessage;
}

function createNormalizedAuthError(message: string, originalError: any): Error {
  const error = new Error(message);
  const response = originalError?.response;

  if (response) {
    (error as Error & { response?: unknown }).response = response;
  }

  return error;
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
    const identifier = credentials.nip.trim();
    const password = credentials.password.trim();

    if (!identifier) {
      return { success: false, message: LOGIN_IDENTIFIER_REQUIRED_MESSAGE };
    }

    if (!password) {
      return { success: false, message: LOGIN_PASSWORD_REQUIRED_MESSAGE };
    }

    const normalizedCredentials = {
      ...credentials,
      nip: identifier,
      password
    };

    // Try backend first
    try {
      const backendAvailable = await isBackendAvailable();
      
      if (backendAvailable) {
        const response = await apiService.post<AuthResponse>('/auth/login', normalizedCredentials);
        
        if (response.success && response.data?.token) {
          persistAuthSession(response.data.user, response.data.token, credentials.rememberMe);
          this.useLocalStorage = false;
        }
        
        return {
          ...response,
          message: response.success ? LOGIN_SUCCESS_MESSAGE : response.message
        };
      }
      if (!ENABLE_LOCAL_FALLBACK) {
        return { success: false, message: LOGIN_SERVER_ISSUE_MESSAGE };
      }
    } catch (error: any) {
      if (!ENABLE_LOCAL_FALLBACK) {
        return { success: false, message: normalizeLoginError(error) };
      }
    }

    // Fallback to localStorage
    this.useLocalStorage = true;
    const result = localLogin(normalizedCredentials);
    
    if (result.success && result.user) {
      const fallbackToken = `local_token_${Date.now()}`;
      persistAuthSession(result.user as unknown as User, fallbackToken, credentials.rememberMe);
      return {
        success: true,
        message: LOGIN_SUCCESS_MESSAGE,
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
        const response = await apiService.post<AuthResponse>('/auth/register', credentials);
        return {
          ...response,
          message: response.success ? 'Pendaftaran berhasil' : response.message
        };
      }

      if (!ENABLE_LOCAL_FALLBACK) {
        return { success: false, message: REGISTER_SERVER_ISSUE_MESSAGE };
      }
    } catch (error: any) {
      if (!ENABLE_LOCAL_FALLBACK) {
        return { success: false, message: normalizeRegisterError(error) };
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
    try {
      return await apiService.post<PasswordResetRequestResponse>('/auth/reset-password/verify', { nip });
    } catch (error: any) {
      throw createNormalizedAuthError(normalizePasswordResetRequestError(error), error);
    }
  }

  async resetPasswordWithCode(payload: PasswordResetPayload): Promise<AuthResponse> {
    try {
      return await apiService.post<AuthResponse>('/auth/reset-password', payload);
    } catch (error: any) {
      throw createNormalizedAuthError(normalizePasswordResetConfirmError(error), error);
    }
  }

  async logout(): Promise<void> {
    try {
      if (!this.useLocalStorage && !isLocalAuthSession()) {
        await apiService.post('/auth/logout', {});
      }
    } catch {
      // Ignore logout API errors
    } finally {
      localLogout();
    }
  }

  async getProfile(): Promise<AuthResponse> {
    if (this.useLocalStorage || isLocalAuthSession()) {
      this.useLocalStorage = true
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
    if (this.useLocalStorage || isLocalAuthSession()) {
      this.useLocalStorage = true
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
          subWorkUnit: payload.subWorkUnit ?? (user as User).subWorkUnit,
          homeAddress: payload.homeAddress ?? (user as User).homeAddress,
          phoneNumber: payload.phoneNumber ?? (user as User).phoneNumber
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
    if (payload.subWorkUnit !== undefined) formData.append('subWorkUnit', payload.subWorkUnit);
    if (payload.homeAddress !== undefined) formData.append('homeAddress', payload.homeAddress);
    if (payload.phoneNumber !== undefined) formData.append('phoneNumber', payload.phoneNumber);
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
