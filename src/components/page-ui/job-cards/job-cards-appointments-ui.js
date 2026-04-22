// file location: src/components/page-ui/job-cards/job-cards-appointments-ui.js

export default function LegacyAppointmentsRedirectPageUi(props) {
  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return null; // render empty page state.
    default:
      return null; // keep unknown sections visually empty.
  }
}
