// file location: src/features/stockAccess/StockAccessPages.js
//
// The page shells every Stock Access store renders. A store's page files
// (src/pages/access/<store>/index.js and manage.js) are a few lines that hand
// their store to these; the role gate, loading state and screen live here once.
// Who may do what is resolved per store by stockAccessPermissions.js — the
// same rules /api/access enforces.

import React, { useMemo } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { EmptyState } from "@/components/ui";
import { SectionGridSkeleton } from "@/components/ui/LoadingSkeleton";
import { hasAllAccessRole } from "@/lib/auth/roles";
import { resolveStockAccessCapabilities } from "@/features/stockAccess/stockAccessPermissions";
import AccessQuickScreen from "@/features/stockAccess/AccessQuickScreen";
import StockAccessManager from "@/features/stockAccess/StockAccessManager";

function useStoreCapabilities(store) {
  const { user, loading } = useUser();
  const roles = useMemo(() => user?.roles || [], [user]);
  const capabilities = useMemo(() => resolveStockAccessCapabilities(roles, hasAllAccessRole(roles), store), [roles, store]);
  return { loading, capabilities };
}

/** /access/<store> — the quick screen. */
export function StockAccessStorePage({ store }) {
  const { loading, capabilities } = useStoreCapabilities(store);
  if (loading) return <SectionGridSkeleton cards={6} />;
  if (!capabilities.view) {
    return (
      <EmptyState
        variant="page"
        role="status"
        title={`${store.label} is not available to your role`}
        description="Ask a manager if you need to log stock here."
      />
    );
  }
  return <AccessQuickScreen key={store.key} store={store} />;
}

/** /access/<store>/manage — the stock table for Parts, managers and admin. */
export function StockAccessManagePage({ store }) {
  const { loading, capabilities } = useStoreCapabilities(store);
  if (loading) return <SectionGridSkeleton cards={6} />;
  if (!capabilities.manage) {
    return (
      <EmptyState
        variant="page"
        role="status"
        title={`Managing ${store.label} is for Parts, managers and admin`}
        description="You can still log movements from the store's quick screen."
      />
    );
  }
  return <StockAccessManager key={store.key} store={store} />;
}

export const stockAccessLayout = (page) => <Layout disableContentCardHover>{page}</Layout>;
