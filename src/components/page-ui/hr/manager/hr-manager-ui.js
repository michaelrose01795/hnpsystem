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
    TabRow,
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
  color: "var(--text-secondary)"
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

    case "section4":
      return <PageShell sectionKey="hr-manager-shell" className="hr-manager-shell">
      <ContentWidth sectionKey="hr-manager-content" parentKey="hr-manager-shell" widthMode="full">
        <TabRow sectionKey="hr-manager-tabs" parentKey="hr-manager-content" className="tab-scroll-row is-overflowing hr-manager-tabs-row">
          <TabGroup ariaLabel="HR sections" items={HR_TABS.map(tab => ({
        value: tab.id,
        label: tab.label
      }))} value={activeTab} onChange={value => setActiveTab(value)} />
        </TabRow>

        <DevLayoutSection sectionKey={`hr-manager-tab-${activeTab}`} parentKey="hr-manager-content" sectionType="section-shell" className="hr-manager-tab-panel">
          <div className="hr-manager-tab-content">
            <ActiveTabComponent />
          </div>
        </DevLayoutSection>
      </ContentWidth>
    </PageShell>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
