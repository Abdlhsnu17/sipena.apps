'use client';

import { useCallback, useEffect, useState } from 'react';
import { authService } from '../services/auth.service';
import type { AuthState } from '../types/auth';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    // Check for existing auth on mount
    const token = authService.getToken();
    const user = authService.getCurrentUser();

    setAuthState({
      user,
      token,
      isAuthenticated: !!token,
      isLoading: false,
    });
  }, []);

  const login = useCallback(async (nip: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await authService.login({ nip, password });
      
      if (response.success && response.data) {
        setAuthState({
          user: response.data.user,
          token: response.data.token,
          isAuthenticated: true,
          isLoading: false,
        });
        return { success: true };
      }
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, message: response.message };
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, message: error.message || 'Login failed' };
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await authService.logout();
    } finally {
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await authService.getProfile();
      if (response.success && response.data) {
        setAuthState(prev => ({
          ...prev,
          user: response.data!.user,
        }));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  return {
    ...authState,
    login,
    logout,
    refreshUser,
  };
}

export default useAuth;
