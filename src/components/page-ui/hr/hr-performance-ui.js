// file location: src/components/page-ui/hr/hr-performance-ui.js

export default function HrPerformanceAppraisalsUi(props) {
  const {
    PerformanceContent,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <PerformanceContent />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
