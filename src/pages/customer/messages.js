// file location: src/pages/customer/messages.js
import CustomerMessagesPage from "@/features/customerPortal/pages/MessagesPage";
import CustomerPortalMessagesUi from "@/components/page-ui/customer/customer-messages-ui"; // Extracted presentation layer.

export default function CustomerPortalMessages() {
  return <CustomerPortalMessagesUi view="section1" CustomerMessagesPage={CustomerMessagesPage} />;
}
