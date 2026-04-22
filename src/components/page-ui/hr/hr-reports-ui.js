// file location: src/components/page-ui/hr/hr-reports-ui.js

export default function HrReportsExportsUi(props) {
  const {
    ReportsContent,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <ReportsContent />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
