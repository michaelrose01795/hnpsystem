import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ensureDevDbUserAndGetId } from "../lib/users/devUsers";
import { getUserActiveJobs } from "../lib/database/jobClocking";
import { getUserById } from "../lib/database/users";

const UserContext = createContext();

export function UserProvider({ children }) {
  const { data: session } = useSession(); // NextAuth session
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Waiting for Job"); // default tech status
  const [dbUserId, setDbUserId] = useState(null);
  const [currentJob, setCurrentJob] = useState(null);

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

  // Resolve Supabase users.user_id when a user is set
  useEffect(() => {
    let cancelled = false;

    const resolveDbUser = async () => {
      if (!user) {
        setDbUserId(null);
        setCurrentJob(null);
        return;
      }

      try {
        const ensuredId = await ensureDevDbUserAndGetId(user);
        if (!cancelled) {
          setDbUserId(ensuredId || null);
        }
      } catch (err) {
        console.error("Failed to resolve workshop user id", err?.message || err);
        if (!cancelled) {
          setDbUserId(null);
        }
      }
    };

    resolveDbUser();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Helper to refresh the technician's active job from job_clocking table
  const refreshCurrentJob = useCallback(async () => {
    if (!dbUserId) {
      setCurrentJob(null);
      return null;
    }

    try {
      const active = await getUserActiveJobs(dbUserId);
      if (active.success && Array.isArray(active.data) && active.data.length > 0) {
        const nextJob = active.data[0];
        setCurrentJob(nextJob);
        return nextJob;
      } else {
        setCurrentJob(null);
        return null;
      }
    } catch (err) {
      console.error("Failed to refresh current job", err?.message || err);
      return null;
    }
  }, [dbUserId]);

  // Keep current job in sync when DB user id changes
  useEffect(() => {
    refreshCurrentJob();
  }, [refreshCurrentJob]);

  // Developer login
  const devLogin = async (userChoice = {}, role = "WORKSHOP") => {
    try {
      let resolved = null;
      const candidateId =
        userChoice?.id ?? userChoice?.user_id ?? userChoice?.identifier;
      if (
        candidateId !== undefined &&
        candidateId !== null &&
        Number.isInteger(Number(candidateId))
      ) {
        resolved = await getUserById(Number(candidateId));
      }

      const fallbackName =
        typeof userChoice === "string"
          ? userChoice
          : userChoice?.name ||
            userChoice?.displayName ||
            userChoice?.fullName ||
            userChoice?.email ||
            "Dev User";

      const finalUser = resolved
        ? {
            id: resolved.id,
            username: resolved.name,
            email: resolved.email,
            roles: [resolved.role?.toUpperCase() || role.toUpperCase()],
          }
        : {
            id: Date.now(),
            username: fallbackName,
            email: userChoice?.email || "",
            roles: [role.toUpperCase()],
          };

      setUser(finalUser);
      localStorage.setItem("devUser", JSON.stringify(finalUser));
      return { success: true };
    } catch (err) {
      console.error("Dev login failed", err);
      return { success: false, error: err };
    }
  };

  // Logout
  const logout = () => {
    setUser(null);
    setStatus("Waiting for Job"); // reset status
    setDbUserId(null);
    setCurrentJob(null);
    localStorage.removeItem("devUser");
  };

  const contextValue = {
    user,
    loading,
    devLogin,
    logout,
    status,
    setStatus,
    dbUserId,
    currentJob,
    setCurrentJob,
    refreshCurrentJob
  };

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
}

// Custom hook
export const useUser = () => useContext(UserContext);
