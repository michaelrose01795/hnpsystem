// file location: src/pages/accounts/create.js
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import CreateAccountRouteShimUi from "@/components/page-ui/accounts/accounts-create-ui"; // Extracted presentation layer.

const CREATE_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER"];

export default function CreateAccountRouteShim() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    router.replace({ pathname: "/accounts", query: { ...router.query, create: "1" } });
  }, [router, router.isReady, router.query]);

  return <CreateAccountRouteShimUi view="section1" CREATE_ROLES={CREATE_ROLES} ProtectedRoute={ProtectedRoute} />;






}
