import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns an authenticated fetch function for direct API calls that are not
 * covered by the generated @workspace/api-client-react hooks.
 */
export function useAdminFetch() {
  const { token } = useAuth();

  return async <T = any>(path: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers ?? {}),
      },
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        message = body.error ?? body.message ?? message;
      } catch {}
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  };
}
