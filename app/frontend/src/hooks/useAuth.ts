import { useState, useEffect, useCallback } from 'react';
import client from '@/lib/client';

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
        const response = await client.auth.me();
        if (response?.data) {
          setUser(response.data as User);
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
    client.auth.toLogin();
  }, []);

  const logout = useCallback(async () => {
    await client.auth.logout();
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}