import { clearAuthSession, getAuthToken } from './auth-utils';

const normalizeApiBaseUrl = (value: string): string => {
  const trimmed = value.replace(/\/$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const envApiUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim();
// if no public API URL is provided, fall back to the Next.js proxy route
// this keeps calls same‑origin (e.g. when frontend and backend are deployed together)
// and prevents the client from ever seeing an explicit localhost host in network requests.
export const API_BASE_URL = envApiUrl ? normalizeApiBaseUrl(envApiUrl) : '/api';
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
// Password verification can legitimately take several seconds on development
// machines. Keep this aligned with the server-side proxy timeout so a successful login
// is not cancelled by the browser just before the response arrives.
const LOGIN_REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.NEXT_PUBLIC_LOGIN_REQUEST_TIMEOUT_MS || '20000',
  10,
);

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
}

interface ApiError extends Error {
  response?: {
    url: string;
    status: number;
    body: unknown;
    raw: string | null;
  };
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    return getAuthToken();
  }

  private getHeaders(skipJsonContentType = false): Record<string, string> {
    const headers: Record<string, string> = {};

    if (!skipJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    const config: RequestInit = {
      method: options.method || 'GET',
      headers: {
        ...this.getHeaders(isFormData),
        ...options.headers,
      },
      signal: controller.signal,
    };

    if (options.body) {
      config.body = isFormData ? options.body : JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Server terlalu lama merespons. Pastikan backend aktif lalu coba lagi.');
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (!response.ok) {
      // build a generic message for the user; do not reveal the internal host
      let errorMessage = `HTTP error! status: ${response.status}`;
      let errorBody: any = null;
      let rawText: string | null = null;
      try {
        errorBody = await response.json();
        if (errorBody && errorBody.message) {
          errorMessage = errorBody.message;
        } else if (typeof errorBody === 'string') {
          errorMessage = errorBody;
        }
      } catch {
        // If JSON parsing fails, try to get raw text
        try {
          rawText = await response.text();
          if (rawText) {
            errorMessage += ` | Raw response: ${rawText}`;
          }
        } catch {
          // ignore
        }
      }
      // in development, record details for debugging; use warn/debug so that
      // the app doesn’t treat it as a real error and flood the console.  we
      // also pass primitives separately to avoid object serialization issues.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('API request failed:', url, 'status', response.status, 'body', errorBody, 'raw', rawText);
      }
      const error = new Error(errorMessage);
      (error as ApiError).response = {
        url,
        status: response.status,
        body: errorBody,
        raw: rawText,
      };
      if (response.status === 401) {
        clearAuthSession();
      }
      throw error;
    }

    return response.json();
  }

  // GET request
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  // POST request
  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data,
      timeoutMs: endpoint === '/auth/login' ? LOGIN_REQUEST_TIMEOUT_MS : undefined,
    });
  }

  // PUT request
  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body: data });
  }

  // PATCH request
  async patch<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body: data });
  }

  // DELETE request
  async delete<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', body: data });
  }
}

export const apiService = new ApiService();
export default apiService;
