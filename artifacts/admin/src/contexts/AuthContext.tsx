import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useLocation } from "wouter";
import { setAuthTokenGetter } from "@workspace/api-client-react";

// Register once at module load — reads the latest value from localStorage on
// every request so there is never a stale-token window between renders.
setAuthTokenGetter(() => localStorage.getItem("jazment_admin_token"));

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

  const login = (newToken: string) => {
    setToken(newToken);
    setLocation("/admin");
  };

  const logout = () => {
    setToken(null);
    setLocation("/login");
  };

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const validateSession = async () => {
      try {
        const response = await fetch("/api/admin/stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && (response.status === 401 || response.status === 403)) {
          localStorage.removeItem("jazment_admin_token");
          setToken(null);
          setLocation("/login");
        }
      } catch {
        // Keep the session during temporary network failures. Individual pages
        // show their request error instead of pretending their lists are empty.
      }
    };

    void validateSession();
    const handleFocus = () => void validateSession();
    window.addEventListener("focus", handleFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, [setLocation, token]);

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
