// file location: src/components/page-ui/clocking/clocking-ui.js

export default function ClockingPageUi(props) {
  const {
    ClockingOverviewTab,
    ContentWidth,
    DevLayoutSection,
    EfficiencyTab,
    FilterToolbarRow,
    PageShell,
    SectionShell,
    TabGroup,
    pageTab,
    setPageTab,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <PageShell sectionKey="clocking-page-shell" style={{
    background: "transparent",
    minHeight: "100vh",
    padding: "24px 0"
  }}>
        <ContentWidth sectionKey="clocking-page-content" parentKey="clocking-page-shell" widthMode="content" className="mx-auto w-full max-w-none space-y-6 px-4 sm:px-6 lg:px-10">
          <FilterToolbarRow sectionKey="clocking-toolbar-row" parentKey="clocking-page-content">
            <TabGroup items={[{
          label: "Overview",
          value: "overview"
        }, {
          label: "Efficiency",
          value: "efficiency"
        }]} value={pageTab} onChange={setPageTab} ariaLabel="Clocking tabs" />
          </FilterToolbarRow>

          {pageTab === "overview" && <ClockingOverviewTab />}
          {pageTab === "efficiency" && <SectionShell sectionKey="clocking-efficiency-shell" parentKey="clocking-page-content">
              <DevLayoutSection sectionKey="clocking-efficiency-content" parentKey="clocking-efficiency-shell" sectionType="content-card">
                <EfficiencyTab editable={false} />
              </DevLayoutSection>
            </SectionShell>}
        </ContentWidth>
      </PageShell>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
