// file location: src/components/ProtectedRoute.js
// ProtectedRoute that waits for auth status and gracefully redirects/blocks pages.
// Place this file at src/components/ProtectedRoute.js (overwrite previous version).

import React, { useEffect } from "react"; // import React + hook
import { useRouter } from "next/router"; // Next.js router for redirects
import { useUser } from "../context/UserContext"; // our user context

export default function ProtectedRoute({ children, allowedRoles = null }) {
  const router = useRouter(); // router instance
  const { user, status } = useUser(); // get user + status from context

  useEffect(() => {
    // don't run on server
    if (typeof window === "undefined") return;

    // while NextAuth is loading, wait
    if (status === "loading") return;

    // if not logged in (no user) → send to login
    if (!user) {
      router.replace("/login"); // redirect to login
      return;
    }

    // if allowedRoles set and user doesn't have any of them → unauthorized
    if (
      allowedRoles &&
      // check both simple user.role and role list from tokens
      !allowedRoles.includes(user.role) &&
      !(user.roles && user.roles.some((r) => allowedRoles.includes(r)))
    ) {
      router.replace("/unauthorized"); // redirect to unauthorized page
    }
  }, [user, status, allowedRoles, router]); // dependencies

  // while loading or not allowed, render nothing (redirect will run)
  if (status === "loading") return null;
  if (!user) return null;
  if (
    allowedRoles &&
    !allowedRoles.includes(user.role) &&
    !(user.roles && user.roles.some((r) => allowedRoles.includes(r)))
  )
    return null;

  // allowed → render children
  return <>{children}</>;
}