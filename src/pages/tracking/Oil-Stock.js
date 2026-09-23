// file location: src/pages/tracking/Oil-Stock.js
//
// /tracking/Oil-Stock — oil and workshop stock levels, usage, orders and
// stocktakes. It used to be the Oil/Stock tab of the four-tab /tracking page and
// is now its own page, reached from the Parts sidebar module. Who sees it and
// what they may change is resolved by src/features/stockControl/stockAccess.js,
// the same rules the stock API enforces.
//
// Stock QR labels open /tracking/Oil-Stock?stock=<itemId>&stockAction=<action>
// (see buildStockQrUrl in src/features/stockControl/stockModel.js); the panel
// turns that into its quick check / use / receive workflow.
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { useMediaQuery } from "@/hooks/useIsMobile";
import { Button, EmptyState, StatusMessage } from "@/components/ui";
import { SearchBar } from "@/components/ui/searchBarAPI";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import TrackingDashboardUi from "@/components/page-ui/tracking/tracking-ui";
import { hasAllAccessRole } from "@/lib/auth/roles";
import { resolveStockCapabilities } from "@/features/stockControl/stockAccess";
import { prefetchStock } from "@/features/stockControl/stockClient";
import { SectionGridSkeleton } from "@/components/ui/LoadingSkeleton";

// The stock screen used to load as a strict chain: session -> panel chunk ->
// stock request, each waiting on the one before, with a blank body until the
// last finished. The page now starts the chunk and the request the moment it
// mounts, in parallel with the session, and shows the panel's own skeleton from
// the first paint. The panel picks up the same in-flight request (stockClient
// shares it), and the API still decides who may read it.
const loadStockPanel = () => import("@/features/stockControl/StockControlPanel");
const StockControlPanel = dynamic(loadStockPanel, {
  ssr: false,
  loading: () => <SectionGridSkeleton cards={6} />,
});

export default function OilStockPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  // The same portrait-phone switch as /tracking/Key-Parking, so every tracker
  // page's header stacks at the same point.
  const isMobileView = useMediaQuery("(max-width: 640px) and (orientation: portrait)");
  const userRoles = useMemo(() => user?.roles || [], [user]);
  const capabilities = useMemo(
    () => resolveStockCapabilities(userRoles, hasAllAccessRole(userRoles)),
    [userRoles]
  );
  const [searchTerm, setSearchTerm] = useState("");
  // Header buttons (Add stock item / Stocktake) are handed to the panel; `at`
  // lets the same button fire twice.
  const [command, setCommand] = useState(null);
  const [focus, setFocus] = useState(null);
  // The header element the panel portals its filter / sort dropdowns into, so
  // they sit on the search row beside the header buttons.
  const [filterSlot, setFilterSlot] = useState(null);
  const clearFocus = useCallback(() => setFocus(null), []);

  useEffect(() => {
    loadStockPanel().catch(() => {}); // the render path retries the chunk
    prefetchStock().catch(() => {}); // the panel reports errors
  }, []);

  useEffect(() => {
    if (!router.isReady || !capabilities.view) return;
    if (typeof router.query.stock !== "string") return;
    setFocus({
      itemId: router.query.stock,
      action: typeof router.query.stockAction === "string" ? router.query.stockAction : "check",
    });
  }, [capabilities.view, router.isReady, router.query.stock, router.query.stockAction]);

  const renderContent = () => {
    if (loading) return <SectionGridSkeleton cards={6} />;
    if (!capabilities.view) {
      return (
        <EmptyState
          variant="page"
          role="status"
          title="Oil and stock are not available to your role"
          description="Ask a manager if you need access to the stock tracker."
        />
      );
    }
    return (
      <StockControlPanel
        searchTerm={searchTerm}
        command={command}
        focus={focus}
        onFocusHandled={clearFocus}
        filterSlot={filterSlot}
      />
    );
  };

  return (
    <TrackingDashboardUi
      view="section1"
      activeTab="oil-stock"
      Button={Button}
      DevLayoutSection={DevLayoutSection}
      SearchBar={SearchBar}
      StatusMessage={StatusMessage}
      isMobileView={isMobileView}
      stockCapabilities={capabilities}
      stockFilterSlotRef={capabilities.view ? setFilterSlot : null}
      onStockCommand={(type) => setCommand({ type, at: Date.now() })}
      renderActiveTabContent={renderContent}
      sharedSearchPlaceholder="Search stock, grade, code, barcode, supplier"
      sharedSearchValue={searchTerm}
      setSharedSearchValue={setSearchTerm}
    />
  );
}

OilStockPage.getLayout = (page) => <Layout disableContentCardHover>{page}</Layout>;
