// frontend/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // Auto-login from token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api.get("/api/auth/me")
        .then(res => setUser(res.data.user))
        .catch(() => localStorage.removeItem("token"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // formData = { email, password }
  const login = async (formData) => {
    const res = await api.post("/api/auth/login", formData);
    localStorage.setItem("token", res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  // formData = { name, email, password, role, walletAddress }
  const register = async (formData) => {
    const res = await api.post("/api/auth/register", formData);
    localStorage.setItem("token", res.data.token);
    // backend now returns user consistently
    if (res.data.user) setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);