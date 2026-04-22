// file location: src/components/page-ui/hr/hr-recruitment-ui.js

export default function HrRecruitmentUi(props) {
  const {
    RecruitmentContent,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <RecruitmentContent />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
