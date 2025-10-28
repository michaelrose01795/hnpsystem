// file location: /src/context/UserContext.js
import React, { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const UserContext = createContext();

export function UserProvider({ children }) {
  const { data: session } = useSession(); // NextAuth session
  const [user, setUser] = useState(null); // user is null by default
  const [loading, setLoading] = useState(true); // loading state
  const [status, setStatus] = useState("Waiting for Job"); // NEW: default status for techs

  // Load saved dev user from localStorage on first render
  useEffect(() => {
    const stored = localStorage.getItem("devUser");
    if (stored && !session?.user) {
      try {
        const parsed = JSON.parse(stored);
        setUser({
          ...parsed,
          id: parsed.id || Date.now(), // ensure unique id
        });
      } catch (err) {
        console.error("Failed to parse dev user from localStorage", err);
      }
    }
    setLoading(false);
  }, [session]);

  // If session comes from Keycloak, set the session user
  useEffect(() => {
    if (session?.user) {
      const keycloakUser = {
        id: session.user.id || Date.now(), // fallback id
        username: session.user.name || "KeycloakUser",
        roles: (session.user.roles || []).map((r) => r.toUpperCase()),
      };
      setUser(keycloakUser);
      localStorage.removeItem("devUser"); // remove dev user if real login occurs
    }
  }, [session]);

  // Developer login (persist to localStorage)
  const devLogin = (username = "dev", role = "WORKSHOP") => {
    const devUser = {
      id: Date.now(),
      username,
      roles: [role.toUpperCase()],
    };
    setUser(devUser);
    localStorage.setItem("devUser", JSON.stringify(devUser));
  };

  // Logout (clear both session + dev user + reset status)
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

// Custom hook for consuming user context safely
export const useUser = () => useContext(UserContext);