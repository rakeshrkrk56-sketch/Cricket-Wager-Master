import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createGuestSession, setAuthTokenGetter } from '@workspace/api-client-react';

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
const INSTALLATION_ID_KEY = 'jazment_installation_id';
const INSTALLATION_SECRET_KEY = 'jazment_installation_secret';
const GUEST_SESSION_TIMEOUT_MS = 10_000;
interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function createGuestSessionWithTimeout(
  installationId: string,
  installationSecret: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GUEST_SESSION_TIMEOUT_MS);
  try {
    return await createGuestSession({ installationId, installationSecret }, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const startGuestSession = useCallback(async () => {
    let installationId = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
    let installationSecret = await AsyncStorage.getItem(INSTALLATION_SECRET_KEY);

    if (!installationId) {
      installationId = `jazment-device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      await AsyncStorage.setItem(INSTALLATION_ID_KEY, installationId);
    }
    if (!installationSecret) {
      installationSecret = `jazment-secret-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 24)}`;
      await AsyncStorage.setItem(INSTALLATION_SECRET_KEY, installationSecret);
    }

    const session = await createGuestSessionWithTimeout(installationId, installationSecret);
    setAuthTokenGetter(() => session.token);
    setToken(session.token);
    setUser(session.user);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, session.token],
      [USER_KEY, JSON.stringify(session.user)],
    ]);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
        const storedUser = await AsyncStorage.getItem(USER_KEY);
        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser) as AuthUser;
          setAuthTokenGetter(() => storedToken);
          setToken(storedToken);
          setUser(parsedUser);
        } else {
          await startGuestSession();
        }
      } catch (error) {
        console.error('Unable to restore auth session', error);
        setAuthTokenGetter(() => null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [startGuestSession]);

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
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    try {
      await startGuestSession();
    } catch (error) {
      setToken(null);
      setUser(null);
      setAuthTokenGetter(() => null);
      console.error('Unable to resume guest session after logout', error);
    }
  }, [startGuestSession]);

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
