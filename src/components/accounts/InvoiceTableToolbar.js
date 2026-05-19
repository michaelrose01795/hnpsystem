// file location: src/components/accounts/InvoiceTableToolbar.js
import React from "react"; // import React for JSX
import PropTypes from "prop-types";
import { INVOICE_STATUSES } from "@/config/accounts";
import { CalendarField } from "@/components/ui/calendarAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import ToolbarRow from "@/components/ui/ToolbarRow";
import Button from "@/components/ui/Button";

// Compact invoice filter toolbar. Extracted from InvoiceTable so the
// /accounts/invoices page can render the filters inline with the page
// header-actions row instead of inside the table card. Search bar uses a
// reduced flex-basis so the search, status, dates and buttons fit one row.
export default function InvoiceTableToolbar({ filters, onFilterChange, onExport, style }) {
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    onFilterChange({ ...filters, [name]: value });
  };
  return (
    <ToolbarRow style={{ minWidth: 0, flex: "1 1 auto", ...style }}>
      <SearchBar
        name="search"
        value={filters.search}
        placeholder="Search invoice or job"
        onChange={handleFilterChange}
        onClear={() => onFilterChange({ ...filters, search: "" })}
        style={{ flex: "1 1 150px", minWidth: 120 }} />

      <DropdownField
        name="status"
        value={filters.status}
        onChange={handleFilterChange}
        placeholder="All statuses"
        options={[{ label: "All Statuses", value: "", placeholder: true }, ...INVOICE_STATUSES.map((status) => ({ label: status, value: status }))]}
        style={{ flex: "0 0 150px" }} />

      <div style={{ flex: "0 0 140px" }}>
        <CalendarField name="from" placeholder="From date" value={filters.from} onChange={handleFilterChange} size="sm" />
      </div>
      <div style={{ flex: "0 0 140px" }}>
        <CalendarField name="to" placeholder="To date" value={filters.to} onChange={handleFilterChange} size="sm" />
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={() => onFilterChange({ ...filters, search: "", status: "", from: "", to: "" })}>Clear Filters</Button>
      <Button type="button" size="sm" onClick={onExport}>Export CSV</Button>
    </ToolbarRow>
  );
}

InvoiceTableToolbar.propTypes = {
  filters: PropTypes.shape({ search: PropTypes.string, status: PropTypes.string, from: PropTypes.string, to: PropTypes.string }),
  onFilterChange: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
  style: PropTypes.object
};
InvoiceTableToolbar.defaultProps = {
  filters: { search: "", status: "", from: "", to: "" },
  style: undefined
};
