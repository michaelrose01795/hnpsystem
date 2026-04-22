// file location: src/components/page-ui/customer/customer-vehicles-ui.js

export default function CustomerPortalVehiclesUi(props) {
  const {
    CustomerVehiclesPage,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <CustomerVehiclesPage />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
