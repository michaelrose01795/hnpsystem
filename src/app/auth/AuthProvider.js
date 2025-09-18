"use client";
import { createContext, useState, useContext } from "react";

// TODO: Integrate Keycloak
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = (username, password) => {
    // TODO: Replace with Keycloak login
    setUser({ name: username, role: "Admin" });
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}