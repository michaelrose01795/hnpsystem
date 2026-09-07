// file location: src/components/page-ui/customers/customers-customer-slug-ui.js
//
// Presentation shell for the staff customer record (/customers/[customerSlug]).
// It owns page structure only — loading, error, header, record search, the tab
// bar and the active tab panel. Every figure and list is derived in
// src/lib/customers/customerHubModel.js and rendered by the components in
// src/features/customers/hub/.

import React from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import StatusMessage from "@/components/ui/StatusMessage";
import EmptyState from "@/components/ui/EmptyState";

export default function CustomerDetailWorkspaceUi(props) {
  const {
    TabGroup,
    PageSkeleton,
    tabDefinitions = [],
    activeTab,
    setActiveTab,
    error,
    isLoading,
    customer,
    header,
    alerts,
    search,
    renderTabContent,
  } = props;

  if (props.view !== "section1") return null;

  return (
    <main
      data-dev-section="1"
      data-dev-section-key="customer-profile-page-shell"
      data-dev-section-type="page-shell"
      className="app-page-stack"
      style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
    >
      {isLoading && PageSkeleton && (
        <PageSkeleton
          sections={[
            { rows: 2, minHeight: "220px" },
            { rows: 1, minHeight: "48px" },
            { rows: 4, minHeight: "320px" },
          ]}
        />
      )}

      {error && !isLoading && (
        <>
          <StatusMessage tone="danger">{error}</StatusMessage>
          {search}
        </>
      )}

      {!isLoading && !error && !customer && (
        <EmptyState
          variant="page"
          icon="🔎"
          title="Customer record not found"
          description="The link may be out of date. Search for the customer by name, email, phone or postcode."
        />
      )}

      {customer && !error && !isLoading && (
        <>
          {header}

          {/* Sits between the header and the tabs so it stays visible whichever
              tab is open — these are the things that need doing today. */}
          {alerts}

          <div
            data-presentation="customer-history"
            data-dev-section="1"
            data-dev-section-key="customer-profile-tabs"
            data-dev-section-type="tab-row"
            data-dev-section-parent="app-layout-page-card"
            className="app-layout-tab-row"
            style={{ display: "inline-flex", alignSelf: "flex-start", maxWidth: "100%", overflowX: "auto" }}
          >
            <TabGroup
              items={tabDefinitions.map((tab) => ({
                label: tab.count === null || tab.count === undefined ? tab.label : `${tab.label} (${tab.count})`,
                value: tab.id,
                devSectionKey: `customer-profile-tab-button-${tab.id}`,
              }))}
              value={activeTab}
              onChange={setActiveTab}
              ariaLabel="Customer record tabs"
              className="tab-api--wrap"
              devSectionKey="customer-profile-tab-group"
              devSectionParent="customer-profile-tabs"
            />
          </div>

          {activeTab === "messages" ? (
            // The Messages tab keeps its own panel chrome, unchanged.
            <LayerTheme
              as="section"
              sectionKey={`customer-profile-tab-${activeTab}`}
              parentKey="app-layout-page-card"
              sectionType="section-shell"
            >
              {renderTabContent()}
            </LayerTheme>
          ) : (
            <div
              data-dev-section="1"
              data-dev-section-key={`customer-profile-tab-${activeTab}`}
              data-dev-section-type="section-shell"
              data-dev-section-parent="app-layout-page-card"
              style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap)", minWidth: 0 }}
            >
              {renderTabContent()}
            </div>
          )}

          {search}
        </>
      )}
    </main>
  );
}
