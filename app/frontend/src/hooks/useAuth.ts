import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/simpleApi';

interface User {
  id: string;
  email?: string;
  name?: string;
  role?: string;
}

const TOKEN_KEY = 'auth_token';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    api.get<User>('/api/v1/auth/me')
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (name: string, password: string) => {
    const data = await api.post<any>('/api/v1/auth/login-simple', { name, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (name: string, password: string) => {
    const data = await api.post<any>('/api/v1/auth/register', { name, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return { user, loading, login, register, logout };
}
