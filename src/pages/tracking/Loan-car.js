// file location: src/pages/tracking/Loan-car.js
//
// /tracking/Loan-car — the loan car calendar, bookings and fleet. It used to be
// the Loan Cars tab of the four-tab /tracking page and is now its own page,
// reached from the Service sidebar module. Who sees it and what they may change
// is resolved by src/features/loanCars/loanCarAccess.js, the same rules the
// loan car API enforces; the sidebar button uses that role list too.
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { useMediaQuery } from "@/hooks/useIsMobile";
import { Button, EmptyState, StatusMessage } from "@/components/ui";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { MonthPickerField } from "@/components/ui/monthPickerAPI";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import TrackingDashboardUi from "@/components/page-ui/tracking/tracking-ui";
import { hasAllAccessRole } from "@/lib/auth/roles";
import { resolveLoanCarCapabilities } from "@/features/loanCars/loanCarAccess";
import { nowStamp } from "@/features/loanCars/loanCarModel";
import { preloadLoanCarSchedule } from "@/hooks/useLoanCarSchedule";
import { SectionSkeleton } from "@/components/ui/LoadingSkeleton";

// The calendar and its drawers are the heaviest part of the page and render
// nothing on the server, so they stay out of the first-load bundle.
//
// They used to load as a strict chain: session -> calendar chunk -> schedule
// request, each waiting on the one before, with a blank body until the last
// finished. The page now starts the chunk and this month's schedule the moment
// it mounts, in parallel with the session, and shows a placeholder from the
// first paint. The calendar's SWR hook picks up the same in-flight request.
const loadSchedulePanel = () => import("@/components/LoanCars/LoanCarSchedulePanel");
const LoanCarSchedulePanel = dynamic(loadSchedulePanel, {
  ssr: false,
  loading: () => <SectionSkeleton showHeader={false} rows={8} />,
});

export default function LoanCarTrackerPage() {
  const { user, loading } = useUser();
  // The same portrait-phone switch as /tracking/Key-Parking, so every tracker
  // page's header stacks at the same point.
  const isMobileView = useMediaQuery("(max-width: 640px) and (orientation: portrait)");
  const userRoles = useMemo(() => user?.roles || [], [user]);
  const capabilities = useMemo(
    () => resolveLoanCarCapabilities(userRoles, hasAllAccessRole(userRoles)),
    [userRoles]
  );
  const [searchTerm, setSearchTerm] = useState("");
  // Header buttons (New loan booking / Quick add / Manage fleet) open drawers
  // inside the panel; the nonce lets the same button fire twice.
  const [request, setRequest] = useState(null);
  const requestLoanCarView = useCallback((view) => setRequest({ view, nonce: Date.now() }), []);
  // The calendar month ("YYYY-MM") lives here so its picker can sit in the
  // header row with the page actions. Set after mount: "this month" is the
  // browser's local day, not the server's.
  const [month, setMonth] = useState("");
  useEffect(() => {
    setMonth((current) => current || nowStamp().slice(0, 7));
    loadSchedulePanel().catch(() => {}); // the render path retries the chunk
    preloadLoanCarSchedule().catch(() => {}); // the calendar reports errors
  }, []);

  const renderContent = () => {
    if (loading) return <SectionSkeleton showHeader={false} rows={8} />;
    if (!capabilities.view) {
      return (
        <EmptyState
          variant="page"
          role="status"
          title="Loan cars are not available to your role"
          description="Ask a manager if you need access to the loan car tracker."
        />
      );
    }
    return (
      <LoanCarSchedulePanel
        mode="tracking"
        searchTerm={searchTerm}
        request={request}
        month={month}
        onMonthChange={setMonth}
      />
    );
  };

  return (
    <TrackingDashboardUi
      view="section1"
      activeTab="loan-cars"
      Button={Button}
      DevLayoutSection={DevLayoutSection}
      SearchBar={SearchBar}
      StatusMessage={StatusMessage}
      isMobileView={isMobileView}
      loanCarCapabilities={capabilities}
      loanCarMonthPicker={
        capabilities.view && month ? (
          <MonthPickerField value={month} onValueChange={setMonth} aria-label="Loan car calendar month" />
        ) : null
      }
      requestLoanCarView={requestLoanCarView}
      renderActiveTabContent={renderContent}
      sharedSearchPlaceholder="Search reg, customer, job, phone or ref"
      sharedSearchValue={searchTerm}
      setSharedSearchValue={setSearchTerm}
    />
  );
}

LoanCarTrackerPage.getLayout = (page) => <Layout disableContentCardHover>{page}</Layout>;
