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
    // if no session + no dev user → redirect
    if (status === "unauthenticated" && !user) {
      router.replace("/login");
    }

    // check role permissions (both keycloak + dev)
    if (allowedRoles && user) {
      const hasRole = (user.roles || []).some((r) =>
        allowedRoles.includes(r.toUpperCase())
      );
      if (!hasRole) {
        router.replace("/unauthorized");
      }
    }
  }, [status, user, allowedRoles, router]);

  return <>{children}</>;
}
