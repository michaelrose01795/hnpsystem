// file location: src/components/page-ui/customer/customer-vhc-ui.js

export default function CustomerPortalVhcUi(props) {
  const {
    CustomerVhcPage,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <CustomerVhcPage />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
