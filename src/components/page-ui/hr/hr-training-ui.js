// file location: src/components/page-ui/hr/hr-training-ui.js

export default function HrTrainingQualificationsUi(props) {
  const {
    TrainingContent,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <TrainingContent />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
