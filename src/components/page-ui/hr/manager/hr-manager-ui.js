// file location: src/components/page-ui/hr/manager/hr-manager-ui.js

export default function HRManagerDashboardUi(props) {
  const {
    ActiveTabComponent,
    ContentWidth,
    DevLayoutSection,
    HR_TABS,
    PageShell,
    StatusMessage,
    TabGroup,
    activeTab,
    setActiveTab,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <div style={{
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "50vh",
  color: "var(--text-1)"
}}>
        Checking access…
      </div>; // render extracted page section.

    case "section2":
      return <div className="app-page-stack" style={{
  padding: "8px 8px 32px"
}}>
        <StatusMessage tone="danger">
          <strong>Access Denied.</strong> You don&apos;t have permission to access the HR Manager dashboard. This area
          is restricted to Owners and Admin Managers.
        </StatusMessage>
      </div>; // render extracted page section.

    case "section3":
      return <div className="app-page-stack" style={{
  padding: "8px 8px 32px"
}}>
        <StatusMessage tone="info">
          <strong>HR Manager Safe Mode.</strong> The dashboard UI is temporarily replaced with this lightweight view so
          we can confirm routing and permissions without rendering the heavier HR widgets. Set{" "}
          <code>NEXT_PUBLIC_HR_MANAGER_SAFE_MODE=false</code> (or remove it) and restart the dev server when you are
          ready to restore the full interface.
        </StatusMessage>
      </div>; // render extracted page section.

    case "section4": {
      const activeTabLabel = HR_TABS.find(tab => tab.id === activeTab)?.label || activeTab;

      // `data-dev-page` / `data-dev-tab` are read by the Dev Overlay via
      // getClosestDataValue(), so setting them ONCE here gives every section in
      // every HR tab a readable "HR Manager > Payroll tab > <card>" locator
      // instead of the raw text-preview fallback. See DevLayoutOverlay.js
      // buildEntry() -> pageContext / tabContext.
      return <PageShell sectionKey="hr-manager-shell" className="hr-manager-shell" data-dev-page="HR Manager">
      <ContentWidth sectionKey="hr-manager-content" parentKey="hr-manager-shell" widthMode="full">
        {/* Registered in its own right so the overlay lists the tab strip as a
            "Tabs" category section rather than folding it into the shell. */}
        <DevLayoutSection
          sectionKey="hr-manager-tab-row"
          parentKey="hr-manager-content"
          sectionType="tab-row"
          data-dev-card-section="HR section tabs"
        >
          <TabGroup
            ariaLabel="HR sections"
            className="tab-api--wrap hr-manager-tabs-row"
            items={HR_TABS.map(tab => ({
          value: tab.id,
          label: tab.label
        }))}
            value={activeTab}
            onChange={value => setActiveTab(value)}
          />
        </DevLayoutSection>

        {/* Tab panel. This is a STRUCTURAL wrapper, not a card: it carries no
            background of its own, so the active tab's sections sit directly on
            StaffLayout's main page card (--surface) and take the second rung of
            the ladder (--theme) themselves. See CLAUDE.md 3.0a-2.

            It still registers with the overlay because every section inside
            every tab hangs off `hr-manager-tab-<id>` as its parentKey, so
            dropping the node would orphan the entire subtree. */}
        <DevLayoutSection
          data-presentation="hr-compliance"
          data-dev-tab={activeTabLabel}
          data-dev-active-tab-label={activeTabLabel}
          data-dev-card-section={`${activeTabLabel} tab panel`}
          sectionKey={`hr-manager-tab-${activeTab}`}
          parentKey="hr-manager-content"
          sectionType="section-shell"
          widthMode="full"
          className="hr-manager-tab-panel hr-manager-tab-content"
          role="tabpanel"
          aria-label={`${activeTabLabel} tab panel`}
        >
          <ActiveTabComponent />
        </DevLayoutSection>
      </ContentWidth>
    </PageShell>; // render extracted page section.
    }
    default:
      return null; // keep unknown sections visually empty.
  }
}
