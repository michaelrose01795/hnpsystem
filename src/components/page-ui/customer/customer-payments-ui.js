// file location: src/components/page-ui/customer/customer-payments-ui.js

export default function CustomerPortalPaymentsUi(props) {
  const {
    CustomerPaymentsPage,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <CustomerPaymentsPage />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
