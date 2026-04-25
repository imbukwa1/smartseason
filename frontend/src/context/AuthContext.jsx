import { createContext, useContext, useEffect, useMemo, useState } from "react";

import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("accessToken"));
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("accessToken")));

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get("/auth/me/");
        if (!isMounted) return;
        setUser(data);
        localStorage.setItem("user", JSON.stringify(data));
      } catch {
        if (!isMounted) return;
        logout();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function login(email, password) {
    const { data: tokenData } = await api.post("/auth/login/", { email, password });

    localStorage.setItem("accessToken", tokenData.access);
    localStorage.setItem("refreshToken", tokenData.refresh);
    setToken(tokenData.access);

    const { data: currentUser } = await api.get("/auth/me/");
    localStorage.setItem("user", JSON.stringify(currentUser));
    setUser(currentUser);

    return currentUser;
  }

  function logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setLoading(false);
  }

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
