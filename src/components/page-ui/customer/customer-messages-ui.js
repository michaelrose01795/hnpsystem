// file location: src/components/page-ui/customer/customer-messages-ui.js

export default function CustomerPortalMessagesUi(props) {
  const {
    CustomerMessagesPage,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <CustomerMessagesPage />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
