// file location: src/components/page-ui/customer/customer-parts-ui.js

export default function CustomerPortalPartsUi(props) {
  const {
    CustomerPartsPage,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <CustomerPartsPage />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
