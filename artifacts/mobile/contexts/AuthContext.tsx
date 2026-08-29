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

function randomCredential(length: number) {
  let value = `${Date.now().toString(36)}-`;
  while (value.length < length) value += Math.random().toString(36).slice(2);
  return value.slice(0, length);
}

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
          setAuthTokenGetter(() => storedToken);
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        } else {
          let installationId = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
          let installationSecret = await AsyncStorage.getItem(INSTALLATION_SECRET_KEY);
          if (!installationId) {
            installationId = randomCredential(36);
            await AsyncStorage.setItem(INSTALLATION_ID_KEY, installationId);
          }
          if (!installationSecret) {
            installationSecret = randomCredential(72);
            await AsyncStorage.setItem(INSTALLATION_SECRET_KEY, installationSecret);
          }
          const session = await createGuestSession({ installationId, installationSecret });
          const guestUser: AuthUser = {
            id: session.user.id,
            phone: session.user.phone,
            name: session.user.name,
            walletBalance: session.user.walletBalance,
            kycStatus: session.user.kycStatus,
            status: session.user.status,
            role: session.user.role,
          };
          setAuthTokenGetter(() => session.token);
          setToken(session.token);
          setUser(guestUser);
          await AsyncStorage.multiSet([
            [TOKEN_KEY, session.token],
            [USER_KEY, JSON.stringify(guestUser)],
          ]);
        }
      } catch (error) {
        console.error('Unable to start guest session', error);
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
