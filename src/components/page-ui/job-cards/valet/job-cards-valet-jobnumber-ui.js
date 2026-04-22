// file location: src/components/page-ui/job-cards/valet/job-cards-valet-jobnumber-ui.js

export default function ValetJobCardPageUi(props) {
  const {
    JobCardDetailPage,
    forcedJobNumber,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <JobCardDetailPage forcedJobNumber={forcedJobNumber} valetMode />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
