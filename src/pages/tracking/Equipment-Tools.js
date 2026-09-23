// file location: src/pages/tracking/Equipment-Tools.js
//
// /tracking/Equipment-Tools — the workshop equipment and tools register. It used
// to be the Equipment/Tools tab of the four-tab /tracking page and is now its
// own page, reached from the Workshop sidebar module. What each role may do is
// resolved by src/features/tracking/equipment/equipmentPermissions.js, the same
// mapping every /api/tracking/equipment route enforces.
//
// Printed QR labels resolve here through /tracking/equipment/EQ-0001, which
// redirects to /tracking/Equipment-Tools?asset=EQ-0001[&action=check|fault].
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { useMediaQuery } from "@/hooks/useIsMobile";
import { Button, EmptyState, StatusMessage } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import TrackingDashboardUi from "@/components/page-ui/tracking/tracking-ui";
import { EQUIPMENT_CATEGORIES } from "@/config/equipmentTracking";
import { resolveEquipmentCapabilities } from "@/features/tracking/equipment/equipmentPermissions";
import { prefetchEquipmentList } from "@/features/tracking/equipment/equipmentClient";
import EquipmentPanelSkeleton from "@/features/tracking/equipment/EquipmentPanelSkeleton";

// The register used to load as a strict chain: session -> panel chunk -> list
// request, each waiting on the one before, with a blank body until the last
// finished. The page now starts the chunk and the list request the moment it
// mounts, in parallel with the session, and shows the register skeleton from
// the first paint. The panel picks up the same in-flight request
// (equipmentClient caches it), and the API still decides who may read it.
const loadEquipmentPanel = () => import("@/features/tracking/equipment/EquipmentTrackerPanel");
const EquipmentTrackerPanel = dynamic(loadEquipmentPanel, {
  ssr: false,
  loading: () => <EquipmentPanelSkeleton />,
});

// Category filter in the header row. The vocabulary (and every other equipment
// rule) lives in src/config/equipmentTracking.js and
// src/features/tracking/equipment/.
const EQUIPMENT_TYPE_FILTERS = [
  { key: "all", value: "all", label: "All equipment" },
  ...EQUIPMENT_CATEGORIES.map((category) => ({ key: category.key, value: category.key, label: category.label })),
];

export default function EquipmentToolsPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  // The same portrait-phone switch as /tracking/Key-Parking, so every tracker
  // page's header stacks at the same point.
  const isMobileView = useMediaQuery("(max-width: 640px) and (orientation: portrait)");
  const capabilities = useMemo(() => resolveEquipmentCapabilities(user?.roles || []), [user]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  // The header's Add button opens the panel's editor; a counter so the same
  // button can fire twice.
  const [addRequest, setAddRequest] = useState(0);
  const [deepLink, setDeepLink] = useState(null);
  const clearDeepLink = useCallback(() => setDeepLink(null), []);

  useEffect(() => {
    loadEquipmentPanel().catch(() => {}); // the render path retries the chunk
    prefetchEquipmentList().catch(() => {}); // the panel reports errors
  }, []);

  // A scanned QR label: ?asset=EQ-0001[&action=check|fault]. The panel opens
  // the record once its list has loaded.
  useEffect(() => {
    if (!router.isReady || !capabilities.view) return;
    if (typeof router.query.asset !== "string") return;
    setDeepLink({
      asset: router.query.asset,
      action: typeof router.query.action === "string" ? router.query.action : "",
    });
  }, [capabilities.view, router.isReady, router.query.action, router.query.asset]);

  const renderContent = () => {
    if (loading) return <EquipmentPanelSkeleton />;
    if (!capabilities.view) {
      return (
        <EmptyState
          variant="page"
          role="status"
          title="Equipment and tools are not available to your role"
          description="Ask a manager if you need access to the equipment register."
        />
      );
    }
    return (
      <EquipmentTrackerPanel
        searchTerm={searchTerm}
        categoryFilter={categoryFilter}
        addRequest={addRequest}
        deepLink={deepLink}
        onDeepLinkHandled={clearDeepLink}
      />
    );
  };

  return (
    <TrackingDashboardUi
      view="section1"
      activeTab="equipment"
      Button={Button}
      DevLayoutSection={DevLayoutSection}
      DropdownField={DropdownField}
      SearchBar={SearchBar}
      StatusMessage={StatusMessage}
      isMobileView={isMobileView}
      canManageEquipment={capabilities.manage}
      onAddEquipment={() => setAddRequest((value) => value + 1)}
      equipmentTypeFilter={categoryFilter}
      equipmentTypeFilters={EQUIPMENT_TYPE_FILTERS}
      setEquipmentTypeFilter={setCategoryFilter}
      renderActiveTabContent={renderContent}
      sharedSearchPlaceholder="Search equipment"
      sharedSearchValue={searchTerm}
      setSharedSearchValue={setSearchTerm}
    />
  );
}

EquipmentToolsPage.getLayout = (page) => <Layout disableContentCardHover>{page}</Layout>;
