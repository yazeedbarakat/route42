import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetMe, setAuthTokenGetter } from "@workspace/api-client-react";

export interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
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
    setToken(null);
  };

  const userData = user ? {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
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
