import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthTokenGetter } from '@workspace/api-client-react';

interface AuthUser {
  id: string;
  phone: string;
  name?: string;
  walletBalance: number;
  kycStatus: string;
  status: string;
  role: string;
}

const TOKEN_KEY = 'jazment_token';
const USER_KEY = 'jazment_user';
interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
        const storedUser = await AsyncStorage.getItem(USER_KEY);
        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser) as AuthUser;
          if (parsedUser.phone.startsWith('guest:')) {
            await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
            setAuthTokenGetter(() => null);
            return;
          }
          setAuthTokenGetter(() => storedToken);
          setToken(storedToken);
          setUser(parsedUser);
        } else {
          await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
          setAuthTokenGetter(() => null);
        }
      } catch (error) {
        console.error('Unable to restore auth session', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Register token getter so all API calls include Authorization header
  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  const login = useCallback(async (newToken: string, newUser: AuthUser) => {
    setAuthTokenGetter(() => newToken);
    setToken(newToken);
    setUser(newUser);
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  }, []);

  const updateUser = useCallback((updatedUser: AuthUser) => {
    setUser(updatedUser);
    AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser)).catch(() => {});
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
