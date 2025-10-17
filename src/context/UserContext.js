// file location: /src/context/UserContext.js
import React, { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const UserContext = createContext();

export function UserProvider({ children }) {
  const { data: session } = useSession();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // loading state

  // Load saved dev user from localStorage on first render
  useEffect(() => {
    const stored = localStorage.getItem("devUser");
    if (stored && !session?.user) {
      const parsed = JSON.parse(stored);
      setUser({ ...parsed, id: parsed.id || Date.now() }); // ensure unique id
      setLoading(false);
      return;
    }
    setLoading(false);
  }, [session]);

  // If session comes from Keycloak, use that
  useEffect(() => {
    if (session?.user) {
      const keycloakUser = {
        id: session.user.id || Date.now(), // ensure unique id
        username: session.user.name,
        roles: (session.user.roles || []).map((r) => r.toUpperCase()),
      };
      setUser(keycloakUser);
      localStorage.removeItem("devUser"); // clear dev user if real login
    }
  }, [session]);

  // Dev login (persist to localStorage, ensure roles are uppercase)
  const devLogin = (username = "dev", role = "WORKSHOP") => {
    const dev = {
      id: Date.now(),
      username,
      roles: [role.toUpperCase()],
    };
    setUser(dev);
    localStorage.setItem("devUser", JSON.stringify(dev));
  };

  // Logout (clear both session + dev user)
  const logout = () => {
    setUser(null);
    localStorage.removeItem("devUser");
  };

  return (
    <UserContext.Provider value={{ user, loading, devLogin, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);