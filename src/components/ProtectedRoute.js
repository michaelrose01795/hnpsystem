// file location: /src/components/ProtectedRoute.js
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useUser } from "../context/UserContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { user, loading } = useUser();

  useEffect(() => {
    if (loading) return; // ✅ wait until user context has finished loading

    // ✅ If dev user exists, trust that
    if (user) {
      if (allowedRoles) {
        const hasRole = (user.roles || []).some((r) =>
          allowedRoles.includes(r.toUpperCase())
        );
        if (!hasRole) router.replace("/unauthorized");
      }
      return; // stop here, don’t check next-auth
    }

    // ✅ Otherwise, check next-auth session
    if (status === "unauthenticated") {
      router.replace("/login");
    }

    if (allowedRoles && session?.user) {
      const hasRole = (session.user.roles || []).some((r) =>
        allowedRoles.includes(r.toUpperCase())
      );
      if (!hasRole) router.replace("/unauthorized");
    }
  }, [loading, status, session, user, allowedRoles, router]);

  // ✅ While loading, show nothing (prevents redirect loops)
  if (loading || status === "loading") {
    return <p>Loading...</p>;
  }

  return <>{children}</>;
}
