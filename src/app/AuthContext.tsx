// src/app/AuthContext.tsx
"use client"; // MUST be first line to mark this as a client-side component

import React, { createContext, useContext, useState, ReactNode } from "react"; // React hooks & types
import { useRouter } from "next/navigation"; // Next.js App Router navigation hook

// Define the type for our auth context
interface AuthContextType {
  user: { username: string; department: string } | null; // current logged-in user info
  login: (username: string, department: string) => void; // function to log in a user
  logout: () => void; // function to log out a user
}

// Create context with optional type
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component to wrap the app and provide auth state
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<{ username: string; department: string } | null>(null); 
  // current user state, initially null
  const router = useRouter(); // Next.js router for navigation

  // login function sets the user
  const login = (username: string, department: string) => {
    setUser({ username, department });
  };

  // logout function clears the user and redirects to login page
  const logout = () => {
    setUser(null);
    router.push("/login"); // navigate to login page
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children} {/* render wrapped children */}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context in any component
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider"); 
  // ensures hook is only used inside the provider
  return context;
};
