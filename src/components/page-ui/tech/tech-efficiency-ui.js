// file location: src/components/page-ui/tech/tech-efficiency-ui.js

export default function TechEfficiencyPageUi(props) {
  const {
    EfficiencyTab,
    ready,
    techUserId,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <div className="tech-efficiency-page-shell">
        {!ready ? <div style={{
      background: "var(--surface)",
      borderRadius: "var(--radius-md)",
      padding: "32px",
      border: "none",
      textAlign: "center",
      color: "var(--info)"
    }}>
            Loading your profile...
          </div> : <EfficiencyTab editable={true} filterUserId={techUserId} editableUserId={techUserId} />}
      </div>
      <style jsx>{`
        .tech-efficiency-page-shell {
          width: 100%;
          min-width: 0;
        }

        @media (max-width: 430px) {
          .tech-efficiency-page-shell {
            margin-top: -4px;
          }
        }
      `}</style>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
