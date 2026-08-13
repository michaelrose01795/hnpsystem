// file location: src/components/page-ui/clocking/clocking-ui.js

export default function ClockingPageUi(props) {
  const {
    ClockingOverviewTab,
    ContentWidth,
    PageShell,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <PageShell sectionKey="clocking-page-shell" className="clocking-page-shell">
        <ContentWidth sectionKey="clocking-page-content" parentKey="clocking-page-shell" widthMode="content">
          <ClockingOverviewTab />
        </ContentWidth>
      </PageShell>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
