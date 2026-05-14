// file location: src/pages/accounts/create.js
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import CreateAccountRouteShimUi from "@/components/page-ui/accounts/accounts-create-ui"; // Extracted presentation layer.
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import RouterParamsOverride from "@/features/presentation/runtime/RouterParamsOverride";
import AccountsListPage from "@/pages/accounts/index";

const CREATE_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER"];

export default function CreateAccountRouteShim() {
  const router = useRouter();
  const inPresentation = isPresentationMode();

  useEffect(() => {
    if (inPresentation) return;
    if (!router.isReady) return;
    router.replace({ pathname: "/accounts", query: { ...router.query, create: "1" } });
  }, [inPresentation, router, router.isReady, router.query]);

  if (inPresentation) {
    return (
      <RouterParamsOverride params={{ create: "1" }} pathname="/accounts">
        <AccountsListPage />
      </RouterParamsOverride>
    );
  }

  return <CreateAccountRouteShimUi view="section1" CREATE_ROLES={CREATE_ROLES} ProtectedRoute={ProtectedRoute} />;






}
