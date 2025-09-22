// file location: src/context/UserContext.js
// Context that exposes user, status, loginWithKeycloak, logout, and dev login helpers.
// Place this file at src/context/UserContext.js (replace previous version).

import React, { createContext, useContext, useEffect, useState } from "react"; // React + hooks
import { useSession, signIn, signOut } from "next-auth/react"; // NextAuth hooks/helpers

const UserContext = createContext(null); // create the context

export function UserProvider({ children }) {
  const { data: session, status } = useSession(); // get next-auth session & status
  const [user, setUser] = useState(null); // local user object (derived from session or dev login)

  // effect: whenever session or status changes, map session → user
  useEffect(() => {
    // if session is authenticated, use session data to build user
    if (status === "authenticated" && session) {
      setUser({
        username: session.user?.name || session.user?.email || "unknown", // friendly name
        email: session.user?.email || null, // email if available
        roles: session.user?.roles || [], // roles from our NextAuth session callback
        isLocal: false, // mark as SSO user
      });
      return; // done
    }

    // if not authenticated, check for a development/local fallback stored in localStorage
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("hnp_dev_user"); // check dev override
        if (raw) {
          const dev = JSON.parse(raw); // parse stored dev user
          setUser({ ...dev, isLocal: true }); // set dev user
          return;
        }
      } catch (err) {
        console.error("UserContext: failed to read dev user from localStorage", err);
      }
    }

    // no session and no dev user → clear user
    setUser(null);
  }, [session, status]); // re-run when session/status changes

  // wrapper to trigger Keycloak SSO via NextAuth
  const loginWithKeycloak = () => {
    return signIn("keycloak"); // redirect to Keycloak sign-in
  };

  // logout wrapper (NextAuth)
  const logout = () => {
    return signOut({ callbackUrl: "/" }); // sign out and return to home
  };

  // dev-only local login (keeps ability to use local login in dev)
  const devLogin = ({ username, role }) => {
    // create a small dev user object and persist to localStorage
    const dev = { username: username || "dev", role: role || "WORKSHOP" };
    if (typeof window !== "undefined") {
      window.localStorage.setItem("hnp_dev_user", JSON.stringify(dev)); // save dev user
    }
    setUser({ ...dev, isLocal: true }); // set as current user
  };

  // dev logout — remove local dev user
  const devLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("hnp_dev_user"); // remove saved dev user
    }
    // if there is an authenticated session, keep it; otherwise clear local user
    if (status !== "authenticated") {
      setUser(null);
    }
  };

  // provide user, status and helpers to app
  return (
    <UserContext.Provider
      value={{ user, status, loginWithKeycloak, logout, devLogin, devLogout }}
    >
      {children}
    </UserContext.Provider>
  );
}

// convenience hook for consuming code
export const useUser = () => {
  return useContext(UserContext);
};