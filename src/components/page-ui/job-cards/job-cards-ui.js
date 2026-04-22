// file location: src/components/page-ui/job-cards/job-cards-ui.js

export default function JobCardsIndexRedirectUi(props) {
  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return null; // render empty page state.
    default:
      return null; // keep unknown sections visually empty.
  }
}
