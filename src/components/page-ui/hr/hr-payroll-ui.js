// file location: src/components/page-ui/hr/hr-payroll-ui.js

export default function HrPayrollUi(props) {
  const {
    PayrollContent,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <PayrollContent />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
