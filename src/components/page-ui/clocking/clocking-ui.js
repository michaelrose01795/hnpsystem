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
      <PageShell sectionKey="clocking-page-shell" className="clocking-page-shell" style={{
    background: "transparent",
    minHeight: "auto",
    padding: "10px 0 0"
  }}>
        <ContentWidth sectionKey="clocking-page-content" parentKey="clocking-page-shell" widthMode="content" className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-10" style={{
      gap: "10px"
    }}>
          <ClockingOverviewTab />
        </ContentWidth>
      </PageShell>
      <style jsx>{`
        :global(.clocking-page-shell) {
          --clocking-page-edge-gap: 1rem;
        }

        @media (min-width: 640px) {
          :global(.clocking-page-shell) {
            --clocking-page-edge-gap: 1.5rem;
          }
        }

        @media (min-width: 1024px) {
          :global(.clocking-page-shell) {
            --clocking-page-edge-gap: 2.5rem;
          }
        }
      `}</style>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
