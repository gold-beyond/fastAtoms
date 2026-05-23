import { useState, useEffect, useCallback } from 'react';
import { authApi } from '@/lib/auth';

interface User {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await authApi.getCurrentUser();
        if (userData) {
          setUser(userData as User);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = useCallback(() => {
    authApi.login();
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}