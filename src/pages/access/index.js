// file location: src/pages/access/index.js
//
// /access — the Stock Access hub: one tile per store the user may use (Back
// Shed, and any store added to src/config/stockAccessStores.js), with a
// Manage link for roles that manage it. Each store lives at /access/<store>.
"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { Button, EmptyState, LayerTheme } from "@/components/ui";
import { SectionGridSkeleton } from "@/components/ui/LoadingSkeleton";
import { hasAllAccessRole } from "@/lib/auth/roles";
import { STOCK_ACCESS_STORES, storeHref, storeManageHref } from "@/config/stockAccessStores";
import { resolveStockAccessCapabilities } from "@/features/stockAccess/stockAccessPermissions";
import { stockAccessLayout } from "@/features/stockAccess/StockAccessPages";
import styles from "@/features/stockAccess/stockAccess.module.css";

export default function StockAccessHubPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const roles = useMemo(() => user?.roles || [], [user]);
  const stores = useMemo(
    () =>
      STOCK_ACCESS_STORES.map((store) => ({ store, capabilities: resolveStockAccessCapabilities(roles, hasAllAccessRole(roles), store) })).filter(
        (entry) => entry.capabilities.view
      ),
    [roles]
  );

  if (loading) return <SectionGridSkeleton cards={3} />;
  if (!stores.length) {
    return (
      <EmptyState
        variant="page"
        role="status"
        title="Stock Access is not available to your role"
        description="Ask a manager if you need to log stock."
      />
    );
  }

  return (
    <div className={styles.screen}>
      <LayerTheme>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Stores</h2>
        </div>
        <div className={styles.tileGrid}>
          {stores.map(({ store, capabilities }) => (
            <div key={store.key} className={styles.sheet}>
              <Button type="button" variant="secondary" symbol={false} className="app-btn--tile" onClick={() => router.push(storeHref(store))}>
                <span className={styles.tileTitle}>{store.label}</span>
                {store.description && <span className={styles.tileMeta}>{store.description}</span>}
              </Button>
              {capabilities.manage && (
                <Button type="button" variant="ghost" size="sm" symbol={false} onClick={() => router.push(storeManageHref(store))}>
                  Manage {store.label}
                </Button>
              )}
            </div>
          ))}
        </div>
      </LayerTheme>
    </div>
  );
}

StockAccessHubPage.getLayout = stockAccessLayout;
