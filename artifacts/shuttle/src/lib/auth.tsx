import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetMe, setAuthTokenGetter } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  profilePicture: string | null;
  createdAt: string;
}

interface AuthContextType {
  user: UserData | null;
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function useTokenState() {
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem("shuttle_token");
  });

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem("shuttle_token", newToken);
    } else {
      localStorage.removeItem("shuttle_token");
    }
    setTokenState(newToken);
    setAuthTokenGetter(newToken ? () => newToken : null);
  };

  useEffect(() => {
    setAuthTokenGetter(token ? () => token : null);
  }, [token]);

  return { token, setToken };
}

function AuthProviderInner({ children, token, setToken }: { children: ReactNode; token: string | null; setToken: (t: string | null) => void }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    }
  });

  useEffect(() => {
    if (error) {
      setToken(null);
    }
  }, [error]);

  const logout = () => {
    // 1. Null the token getter immediately — all subsequent fetch calls send
    //    no Authorization header even before the React state update fires.
    setAuthTokenGetter(null);
    localStorage.removeItem("shuttle_token");
    sessionStorage.clear();
    // 2. Update React state so every query with `enabled: !!token` disables.
    setToken(null);
    // 3. Remove only the /auth/me entry so Login's redirect guard sees no user.
    //    We intentionally do NOT call queryClient.clear() here: that would
    //    notify observers to re-schedule fetches while the token state update
    //    hasn't propagated yet, causing a flood of unauthenticated requests.
    queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
  };

  const userData = user ? {
    id:             user.id,
    name:           user.name,
    email:          user.email,
    role:           user.role,
    phone:          (user as unknown as { phone?: string | null }).phone ?? null,
    profilePicture: (user as unknown as { profilePicture?: string | null }).profilePicture ?? null,
    createdAt:      user.createdAt,
  } : null;

  return (
    <AuthContext.Provider value={{ user: userData, token, setToken, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { token, setToken } = useTokenState();
  return <AuthProviderInner token={token} setToken={setToken}>{children}</AuthProviderInner>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
