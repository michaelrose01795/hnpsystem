// src/app/AuthContext.tsx
"use client"; // MUST be first line

import React, { createContext, useContext, useState, ReactNode } from "react";
import { useRouter } from "next/navigation"; // App Router compatible

interface AuthContextType {
  user: { username: string; department: string } | null;
  login: (username: string, department: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<{ username: string; department: string } | null>(null);
  const router = useRouter();

  const login = (username: string, department: string) => {
    setUser({ username, department });
  };

  const logout = () => {
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
