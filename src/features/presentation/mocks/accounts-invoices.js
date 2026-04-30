import InvoicesPageUi from "@/components/page-ui/accounts/invoices/accounts-invoices-ui";
import InvoiceTable from "@/components/accounts/InvoiceTable";
import { MockPage } from "./_helpers";

const demoInvoices = [
  { id: "inv-001", invoice_number: "INV-1042", customer_name: "Alex Morgan", amount: 482.5, status: "Paid", date: "2026-04-22" },
  { id: "inv-002", invoice_number: "INV-1043", customer_name: "Priya Shah", amount: 1245.0, status: "Pending", date: "2026-04-23" },
  { id: "inv-003", invoice_number: "INV-1044", customer_name: "Tom Reynolds", amount: 312.75, status: "Paid", date: "2026-04-23" },
];

export default function AccountsInvoicesMock() {
  return (
    <MockPage
      Ui={InvoicesPageUi}
      overrides={{
        view: "section1",
        invoices: demoInvoices,
        InvoiceTable,
        filters: { status: "all", search: "" },
        pagination: { page: 1, total: demoInvoices.length, pageSize: 10 },
      }}
    />
  );
}
