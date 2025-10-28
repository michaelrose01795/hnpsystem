import React, { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const UserContext = createContext();

export function UserProvider({ children }) {
  const { data: session } = useSession(); // NextAuth session
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Waiting for Job"); // default tech status

  // Load dev user from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("devUser");
    if (stored && !session?.user) {
      try {
        const parsed = JSON.parse(stored);
        setUser({ ...parsed, id: parsed.id || Date.now() });
      } catch (err) {
        console.error("Failed to parse dev user from localStorage", err);
      }
    }
    setLoading(false);
  }, [session]);

  // Set Keycloak session user
  useEffect(() => {
    if (session?.user) {
      const keycloakUser = {
        id: session.user.id || Date.now(),
        username: session.user.name || "KeycloakUser",
        roles: (session.user.roles || []).map((r) => r.toUpperCase()),
      };
      setUser(keycloakUser);
      localStorage.removeItem("devUser");
    }
  }, [session]);

  // Developer login
  const devLogin = (username = "dev", role = "WORKSHOP") => {
    const devUser = { id: Date.now(), username, roles: [role.toUpperCase()] };
    setUser(devUser);
    localStorage.setItem("devUser", JSON.stringify(devUser));
  };

  // Logout
  const logout = () => {
    setUser(null);
    setStatus("Waiting for Job"); // reset status
    localStorage.removeItem("devUser");
  };

  return (
    <UserContext.Provider value={{ user, loading, devLogin, logout, status, setStatus }}>
      {children}
    </UserContext.Provider>
  );
}

// Custom hook
export const useUser = () => useContext(UserContext);