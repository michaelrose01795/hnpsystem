// file location: /src/components/ProtectedRoute.js
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react"; // keycloak session
import { useUser } from "../context/UserContext"; // custom user context

export default function ProtectedRoute({ children, allowedRoles }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { user } = useUser();

  useEffect(() => {
    // ✅ If we have a dev user, skip next-auth checks
    if (user) {
      if (allowedRoles) {
        const hasRole = (user.roles || []).some((r) =>
          allowedRoles.includes(r.toUpperCase())
        );
        if (!hasRole) {
          router.replace("/unauthorized");
        }
      }
      return; // stop here, don’t check session
    }

    // otherwise fall back to next-auth session check
    if (status === "unauthenticated") {
      router.replace("/login");
    }

    // role check if session exists
    if (allowedRoles && session?.user) {
      const hasRole = (session.user.roles || []).some((r) =>
        allowedRoles.includes(r.toUpperCase())
      );
      if (!hasRole) {
        router.replace("/unauthorized");
      }
    }
  }, [status, session, user, allowedRoles, router]);

  return <>{children}</>;
}
