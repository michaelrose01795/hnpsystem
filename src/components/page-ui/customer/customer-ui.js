// file location: src/components/page-ui/customer/customer-ui.js

export default function CustomerPortalIndexUi(props) {
  const {
    CustomerDashboardPage,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <CustomerDashboardPage />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
