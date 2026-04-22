// file location: src/components/page-ui/hr/hr-leave-ui.js

export default function HrLeaveManagementUi(props) {
  const {
    LeaveContent,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <LeaveContent />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
