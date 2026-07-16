import { useState, useEffect } from "react";
import { hasStoredAuth, clearAuth } from "@/lib/auth";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsAuthenticated(hasStoredAuth());
    setIsLoading(false);
  }, []);

  const login = () => setIsAuthenticated(true);
  const logout = () => {
    clearAuth();
    setIsAuthenticated(false);
  };

  return { isAuthenticated, isLoading, login, logout };
}