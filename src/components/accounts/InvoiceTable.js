// file location: src/components/accounts/InvoiceTable.js // header for clarity
import React from "react"; // import React for JSX
import PropTypes from "prop-types";
import { useRouter } from "next/router";
import { INVOICE_STATUSES } from "@/config/accounts";
import { isInvoiceSettled } from "@/lib/status/statusHelpers"; // Centralized invoice status check.
import { CalendarField } from "@/components/ui/calendarAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import ToolbarRow from "@/components/ui/ToolbarRow";
import Button from "@/components/ui/Button";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const getInvoiceDisplayValue = (invoice) =>
  invoice?.invoice_number || invoice?.invoice_id || invoice?.id || "—";

const getCustomerDisplayValue = (invoice) => {
  const invoiceToName = typeof invoice?.invoice_to?.name === "string" ? invoice.invoice_to.name.trim() : "";
  if (invoiceToName) return invoiceToName;

  const customerName = typeof invoice?.customer_name === "string" ? invoice.customer_name.trim() : "";
  if (customerName) return customerName;

  const linkedCustomerName =
    invoice?.customer?.name ||
    [invoice?.customer?.firstname, invoice?.customer?.lastname].filter(Boolean).join(" ").trim();
  if (linkedCustomerName) return linkedCustomerName;

  return invoice?.customer_id || "—";
};

const getAccountDisplayValue = (invoice) =>
  invoice?.account?.billing_name ||
  invoice?.account_number ||
  invoice?.account?.account_id ||
  invoice?.account_id ||
  "—";

const getInvoiceAmountValue = (invoice) =>
  Number(
    invoice?.invoice_total ??
    invoice?.grand_total ??
    invoice?.total ??
    0
  );

const getDueDateDisplayValue = (invoice) => {
  const explicitDueDate = invoice?.due_date ? new Date(invoice.due_date) : null;
  if (explicitDueDate && !Number.isNaN(explicitDueDate.getTime())) {
    return explicitDueDate.toLocaleDateString("en-GB");
  }

  const invoiceDate = invoice?.invoice_date ? new Date(invoice.invoice_date) : null;
  if (!invoiceDate || Number.isNaN(invoiceDate.getTime())) return "—";

  const creditTerms = Number(invoice?.account?.credit_terms || 30) || 30;
  invoiceDate.setDate(invoiceDate.getDate() + creditTerms);
  return invoiceDate.toLocaleDateString("en-GB");
};

const isInvoiceOverdue = (invoice) => {
  if (!invoice) return false;
  const status = invoice.payment_status || invoice.status || "";
  if (isInvoiceSettled(status)) return false; // Paid or cancelled — not overdue.
  const due = invoice.due_date ? new Date(invoice.due_date) : invoice.invoice_date ? new Date(invoice.invoice_date) : null;
  if (due && !invoice.due_date) {
    const creditTerms = Number(invoice?.account?.credit_terms || 30) || 30;
    due.setDate(due.getDate() + creditTerms);
  }
  if (!due) return false;
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
};
export default function InvoiceTable({ invoices, filters, onFilterChange, pagination, onPageChange, onExport, loading, accentSurface = false, navigationDisabled = false }) {
  const router = useRouter();
  void onPageChange;
  const [hoveredInvoiceId, setHoveredInvoiceId] = React.useState(null);
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    onFilterChange({ ...filters, [name]: value });
  };
  const handleOpenInvoice = React.useCallback(
    (invoice) => {
      if (navigationDisabled) return;
      const invoiceRouteValue = getInvoiceDisplayValue(invoice);
      if (!invoiceRouteValue || invoiceRouteValue === "—") return;
      router.push(`/accounts/invoices/${encodeURIComponent(invoiceRouteValue)}`);
    },
    [navigationDisabled, router]
  );

  const filteredInvoices = React.useMemo(() => {
    return (invoices || []).filter((invoice) => {
      const search = String(filters.search || "").trim().toLowerCase();
      const createdDate = invoice.created_at ? new Date(invoice.created_at) : null;
      const fromDate = filters.from ? new Date(filters.from) : null;
      const toDate = filters.to ? new Date(filters.to) : null;
      const invoiceStatus = invoice.payment_status || invoice.status || "";

      if (filters.status && invoiceStatus !== filters.status) return false;
      if (fromDate && createdDate && createdDate < fromDate) return false;
      if (toDate && createdDate && createdDate > toDate) return false;
      if (search) {
        const haystack = [
          invoice.invoice_id,
          invoice.invoice_number,
          invoice.customer_id,
          invoice.account_id,
          invoice.job_number,
          invoice.order_number,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [invoices, filters]);
  const totalRecords = pagination?.total || filteredInvoices.length || 0;

  return (
    <DevLayoutSection
      as="section"
      sectionKey="accounts-invoices-table-card"
      sectionType="content-card"
      parentKey="accounts-invoices-table"
      backgroundToken={accentSurface ? "accent-surface" : "surface"}
      className="app-section-card"
      style={{ display: "flex", flexDirection: "column", gap: "16px", ...(accentSurface ? { background: "rgba(var(--primary-rgb), 0.08)", border: "1px solid rgba(var(--primary-rgb), 0.16)" } : {}) }}
    >
      <DevLayoutSection sectionKey="accounts-invoices-table-header" sectionType="content-card" parentKey="accounts-invoices-table-card">
        <header style={{ display: "grid", gridTemplateColumns: "auto minmax(280px, 1fr) auto", alignItems: "center", gap: "12px" }}>
          <DevLayoutSection sectionKey="accounts-invoices-table-title" sectionType="content-card" parentKey="accounts-invoices-table-header">
            <div>
              <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.1rem" }}>Invoices</h3>
              <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: "0.92rem" }}>{totalRecords} records</p>
            </div>
          </DevLayoutSection>
          <DevLayoutSection sectionKey="accounts-invoices-table-filters" sectionType="filter-row" parentKey="accounts-invoices-table-header">
            <ToolbarRow style={{ minWidth: 0 }}>
              <SearchBar
                name="search"
                value={filters.search}
                placeholder="Search invoice or job"
                onChange={handleFilterChange}
                onClear={() => onFilterChange({ ...filters, search: "" })}
                style={{ flex: "1 1 240px" }}
              />
              <DropdownField
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                placeholder="All statuses"
                options={[{ label: "All Statuses", value: "", placeholder: true }, ...INVOICE_STATUSES.map((status) => ({ label: status, value: status }))]}
                style={{ flex: "0 0 180px" }}
              />
              <div style={{ flex: "0 0 160px" }}>
                <CalendarField name="from" placeholder="From date" value={filters.from} onChange={handleFilterChange} size="sm" />
              </div>
              <div style={{ flex: "0 0 160px" }}>
                <CalendarField name="to" placeholder="To date" value={filters.to} onChange={handleFilterChange} size="sm" />
              </div>
            </ToolbarRow>
          </DevLayoutSection>
          <DevLayoutSection sectionKey="accounts-invoices-table-actions" sectionType="toolbar" parentKey="accounts-invoices-table-header">
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => onFilterChange({ ...filters, search: "", status: "", from: "", to: "" })}>Clear Filters</Button>
              <Button type="button" size="sm" onClick={onExport}>Export CSV</Button>
            </div>
          </DevLayoutSection>
        </header>
      </DevLayoutSection>
      <DevLayoutSection sectionKey="accounts-invoices-table-scroll" sectionType="content-card" parentKey="accounts-invoices-table-card">
        <div style={{ overflowX: "auto", overflowY: filteredInvoices.length > 10 ? "auto" : "visible", maxHeight: filteredInvoices.length > 10 ? "640px" : "none" }}>
          <table data-dev-section-key="accounts-invoices-data-table" data-dev-section-type="data-table" data-dev-section-parent="accounts-invoices-table-card" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead data-dev-section-key="accounts-invoices-data-table-headings" data-dev-section-type="table-headings" data-dev-section-parent="accounts-invoices-data-table" style={{ background: "rgba(var(--primary-rgb), 0.08)", color: "var(--text-primary)" }}>
            <tr>
              <th style={{ textAlign: "left", padding: "12px" }}>Invoice</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Customer</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Account</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Job</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Grand Total</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Status</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Due</th>
            </tr>
            </thead>
            <tbody data-dev-section-key="accounts-invoices-data-table-rows" data-dev-section-type="table-rows" data-dev-section-parent="accounts-invoices-data-table">
            {loading && (
              <tr>
                <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>Loading invoices…</td>
              </tr>
            )}
            {!loading && filteredInvoices.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>No invoices found.</td>
              </tr>
            )}
            {!loading && filteredInvoices.map((invoice) => {
              const overdue = isInvoiceOverdue(invoice);
              return (
                <tr
                  key={invoice.invoice_id}
                  onClick={() => handleOpenInvoice(invoice)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleOpenInvoice(invoice);
                    }
                  }}
                  onMouseEnter={() => setHoveredInvoiceId(invoice.invoice_id)}
                  onMouseLeave={() => setHoveredInvoiceId((current) => (current === invoice.invoice_id ? null : current))}
                  tabIndex={navigationDisabled ? undefined : 0}
                  role={navigationDisabled ? undefined : "button"}
                  aria-label={navigationDisabled ? undefined : `Open invoice ${getInvoiceDisplayValue(invoice)}`}
                  style={{ borderTop: "1px solid rgba(var(--primary-rgb), 0.08)", background: hoveredInvoiceId === invoice.invoice_id ? "rgba(var(--primary-rgb), 0.12)" : "var(--surface)", transition: "background-color 0.18s ease", cursor: navigationDisabled ? "default" : "pointer" }}
                >
                  <td style={{ padding: "12px", fontWeight: 600 }}>{getInvoiceDisplayValue(invoice)}</td>
                  <td style={{ padding: "12px" }}>{getCustomerDisplayValue(invoice)}</td>
                  <td style={{ padding: "12px" }}>{getAccountDisplayValue(invoice)}</td>
                  <td style={{ padding: "12px" }}>{invoice.job_number || "—"}</td>
                  <td style={{ padding: "12px", fontWeight: 600 }}>{currencyFormatter.format(getInvoiceAmountValue(invoice))}</td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ padding: "4px 12px", borderRadius: "var(--radius-pill)", background: "rgba(var(--primary-rgb), 0.12)", color: "var(--text-primary)", fontWeight: 600 }}>{invoice.payment_status || invoice.status || "Draft"}</span>
                  </td>
                  <td style={{ padding: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    {getDueDateDisplayValue(invoice)}
                    {overdue && <span style={{ background: "var(--warning-surface)", color: "var(--warning-text)", borderRadius: "var(--radius-pill)", padding: "2px 10px", fontSize: "0.75rem", fontWeight: 700 }}>Overdue</span>}
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </DevLayoutSection>
    </DevLayoutSection>
  );
}
InvoiceTable.propTypes = {
  invoices: PropTypes.arrayOf(PropTypes.object),
  filters: PropTypes.shape({ search: PropTypes.string, status: PropTypes.string, from: PropTypes.string, to: PropTypes.string }),
  onFilterChange: PropTypes.func.isRequired,
  pagination: PropTypes.shape({ page: PropTypes.number, pageSize: PropTypes.number, total: PropTypes.number }),
  onPageChange: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  accentSurface: PropTypes.bool,
  navigationDisabled: PropTypes.bool,
};
InvoiceTable.defaultProps = {
  invoices: [],
  filters: { search: "", status: "", from: "", to: "" },
  pagination: { page: 1, pageSize: 20, total: 0 },
  loading: false,
  accentSurface: false,
  navigationDisabled: false,
};
