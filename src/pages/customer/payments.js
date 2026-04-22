// file location: src/pages/customer/payments.js
import CustomerPaymentsPage from "@/features/customerPortal/pages/PaymentsPage";
import CustomerPortalPaymentsUi from "@/components/page-ui/customer/customer-payments-ui"; // Extracted presentation layer.

export default function CustomerPortalPayments() {
  return <CustomerPortalPaymentsUi view="section1" CustomerPaymentsPage={CustomerPaymentsPage} />;
}
