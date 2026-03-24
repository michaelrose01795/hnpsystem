// file location: src/pages/accounts/create.js // route shim to open the accounts create popup
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";

const CREATE_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER"];

export default function CreateAccountRouteShim() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    router.replace({ pathname: "/accounts", query: { ...router.query, create: "1" } });
  }, [router, router.isReady, router.query]);

  return (
    <ProtectedRoute allowedRoles={CREATE_ROLES}>
      <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
        Opening account form…
      </div>
    </ProtectedRoute>
  );
}
