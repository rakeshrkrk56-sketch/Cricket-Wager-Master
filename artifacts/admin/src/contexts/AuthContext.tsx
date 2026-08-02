import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useLocation } from "wouter";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("jazment_admin_token"));
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (token) {
      localStorage.setItem("jazment_admin_token", token);
    } else {
      localStorage.removeItem("jazment_admin_token");
    }
  }, [token]);

  // Wire the token into the generated API client so every hook sends
  // Authorization: Bearer <token> automatically.
  useEffect(() => {
    setAuthTokenGetter(token ? () => token : null);
  }, [token]);

  const login = (newToken: string) => {
    setToken(newToken);
    setLocation("/");
  };

  const logout = () => {
    setToken(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
