// file location: src/components/page-ui/hr/hr-disciplinary-ui.js

export default function HrDisciplinaryIncidentsUi(props) {
  const {
    DisciplinaryContent,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <DisciplinaryContent />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
