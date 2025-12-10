// file location: src/components/accounts/AccountTable.js // file path header
import React from "react"; // import React to define component
import PropTypes from "prop-types"; // import PropTypes for validation
const columnDefinitions = [ // describe columns rendered in the accounts list
  { key: "account_id", label: "Account ID" }, // show unique account identifier
  { key: "customer_id", label: "Customer" }, // show related customer identifier
  { key: "account_type", label: "Type" }, // show account type string
  { key: "status", label: "Status" }, // show account status badge
  { key: "balance", label: "Balance" }, // show running balance value
  { key: "credit_limit", label: "Credit Limit" }, // show credit limit value
  { key: "billing_name", label: "Billing Name" }, // show billing contact name
  { key: "updated_at", label: "Updated" }, // show last update timestamp
]; // close columnDefinitions array
const formatCurrency = (value) => { // helper to format numeric values as GBP currency
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value || 0)); // use UK currency formatting to match DMS theme
}; // close formatCurrency
const formatDate = (value) => { // helper to format ISO timestamps
  if (!value) return "—"; // guard against missing values
  const date = new Date(value); // parse date string
  if (Number.isNaN(date.getTime())) return "—"; // guard invalid dates
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); // display friendly date string
}; // close formatDate helper
const statusStyles = { // dictionary of badge colors keyed by status
  active: { background: "rgba(16,185,129,0.15)", color: "#047857" }, // green styling for active accounts
  frozen: { background: "rgba(245,158,11,0.18)", color: "#b45309" }, // amber styling for frozen accounts
  closed: { background: "rgba(239,68,68,0.15)", color: "#b91c1c" }, // red styling for closed accounts
}; // close statusStyles map
const renderStatusBadge = (status) => { // helper to render status badge element
  const normalized = (status || "").toLowerCase(); // normalize status string for lookups
  const palette = statusStyles[normalized] || statusStyles.active; // choose style fallback to active palette
  return ( // return styled span representing status badge
    <span // badge wrapper
      style={{ // inline styling for badge
        padding: "4px 10px", // add breathing space
        borderRadius: "999px", // pill shaped badge
        fontSize: "0.75rem", // compact text size
        fontWeight: 700, // bold text for emphasis
        textTransform: "uppercase", // uppercase label per UI spec
        ...palette, // apply palette colors
      }} // close style object
    >
      {status || "Unknown"} // render provided status text or fallback
    </span>
  ); // close span element
}; // close renderStatusBadge
export default function AccountTable({ accounts, loading, pagination, onPageChange, onSortChange, sortState, onSelectAccount, selectedAccountId }) { // table component definition
  const sortedIcon = (columnKey) => { // helper to show icon for active sort column
    if (!sortState || sortState.field !== columnKey) return ""; // hide icon when column is not sorted
    return sortState.direction === "asc" ? "▲" : "▼"; // show directional triangle for sort order
  }; // close sortedIcon helper
  const handleSort = (columnKey) => { // helper invoked when the user clicks a column header
    if (typeof onSortChange !== "function") return; // guard missing callback
    if (sortState && sortState.field === columnKey) { // toggle direction when clicking same column
      const toggledDir = sortState.direction === "asc" ? "desc" : "asc"; // compute new direction
      onSortChange({ field: columnKey, direction: toggledDir }); // propagate toggled state
      return; // exit handler after toggling
    } // close existing sort branch
    onSortChange({ field: columnKey, direction: "asc" }); // default to ascending sort when selecting new column
  }; // close handleSort helper
  return ( // render table container
    <div // wrap table with overflow to handle responsive layout
      style={{ // style container to mimic DMS cards
        borderRadius: "16px", // card corners
        border: "1px solid var(--surface-light)", // subtle border
        background: "var(--surface)", // card background
        boxShadow: "none", // keep flat look consistent with rest of UI
      }} // close container style
    >
      <table // semantic table element for accounts grid
        style={{ // style table for full width display
          width: "100%", // table should fill container
          borderCollapse: "collapse", // collapse cell borders
        }} // close table style
      >
        <thead // table header section
          style={{ // style header row background
            background: "var(--primary)", // brand background color
            color: "white", // white text for contrast
          }} // close thead style
        >
          <tr> // header row element
            {columnDefinitions.map((column) => ( // iterate over column definitions
              <th // table header cell for each column
                key={column.key} // stable key for React list
                onClick={() => handleSort(column.key)} // allow sorting by clicking header
                style={{ // style header cell
                  padding: "12px", // add spacing for readability
                  cursor: "pointer", // show pointer to hint sorting ability
                  textAlign: "left", // left align header text
                  fontSize: "0.85rem", // adjust font size for header
                  userSelect: "none", // prevent text selection on click
                }} // close header cell style
              >
                {column.label} {sortedIcon(column.key)} // render label and optional sort indicator
              </th>
            ))}
            <th // header cell for action column
              style={{ // style action header
                padding: "12px", // spacing consistent with other headers
                textAlign: "right", // align actions to the right edge
                fontSize: "0.85rem", // match header font size
              }} // close action header style
            >
              Actions // label for action column
            </th>
          </tr>
        </thead>
        <tbody> // table body containing account records
          {loading && ( // render skeleton row while loading data
            <tr>
              <td // single cell spanning all columns to show loading message
                colSpan={columnDefinitions.length + 1} // span across data columns plus action column
                style={{ // style loading cell
                  padding: "20px", // extra padding for message
                  textAlign: "center", // center loading text
                  color: "var(--text-secondary)", // muted tone for message
                }} // close loading cell style
              >
                Loading accounts… // loading message text
              </td>
            </tr>
          )}
          {!loading && accounts.length === 0 && ( // render empty state when there are no accounts
            <tr>
              <td // single cell spanning all columns to show empty message
                colSpan={columnDefinitions.length + 1} // span across data columns plus actions column
                style={{ // style empty state cell
                  padding: "40px", // generous padding to balance whitespace
                  textAlign: "center", // center message text
                  color: "var(--text-secondary)", // muted tone for message
                }} // close cell style
              >
                No accounts match your filters. // empty state text
              </td>
            </tr>
          )}
          {!loading && accounts.map((account) => { // render actual account rows when data is available
            const isSelected = selectedAccountId && selectedAccountId === account.account_id; // check if this row is currently selected
            return ( // return table row for account
              <tr // data row wrapper
                key={account.account_id} // unique key for React reconciliation
                style={{ // style data row to support selection highlight
                  background: isSelected ? "rgba(var(--primary-rgb),0.05)" : "transparent", // highlight selected row with subtle tint
                  borderTop: "1px solid rgba(0,0,0,0.04)", // add divider between rows
                }} // close row style
              >
                {columnDefinitions.map((column) => { // render cells for each configured column
                  const value = account[column.key]; // read raw value from account object
                  let content = value; // default cell content to raw value
                  if (column.key === "status") { // render badge for status column
                    content = renderStatusBadge(value); // use badge renderer for status display
                  } else if (column.key === "balance" || column.key === "credit_limit") { // format numeric currency columns
                    content = formatCurrency(value); // convert value to currency string
                  } else if (column.key === "updated_at") { // format timestamp columns
                    content = formatDate(value); // convert timestamp to friendly date
                  }
                  return ( // render table cell with computed content
                    <td // table data cell element
                      key={column.key} // key for React list within row
                      style={{ // style data cell
                        padding: "14px 12px", // consistent cell padding
                        fontWeight: column.key === "account_id" ? 600 : 400, // bold account id for quick scanning
                      }} // close cell style
                    >
                      {content || "—"} // render value or em dash when empty
                    </td>
                  ); // close cell return
                })}
                <td // actions cell at the end of the row
                  style={{ // style actions cell
                    padding: "14px 12px", // pad to align with other cells
                    textAlign: "right", // align actions to right side
                  }} // close style object
                >
                  <button // inline view button to open account details
                    type="button" // button semantics
                    onClick={() => onSelectAccount && onSelectAccount(account, "view")} // notify parent when view is requested
                    style={{ // style view button as subtle link
                      border: "none", // remove border for link feel
                      background: "transparent", // no background
                      color: "var(--primary)", // brand color text
                      fontWeight: 600, // highlight action text
                      marginRight: "12px", // space between buttons
                      cursor: "pointer", // pointer cursor on hover
                    }} // close button style
                  >
                    View // label for view action
                  </button>
                  <button // inline edit button
                    type="button" // semantics for button
                    onClick={() => onSelectAccount && onSelectAccount(account, "edit")} // notify parent when edit requested
                    style={{ // style edit button with subtle background
                      border: "1px solid var(--primary)", // outline style for edit button
                      background: "rgba(var(--primary-rgb),0.08)", // faint tinted background
                      color: "var(--primary)", // brand colored text
                      fontWeight: 600, // emphasise action text
                      borderRadius: "8px", // soften corners
                      padding: "6px 12px", // add tap target spacing
                      cursor: "pointer", // pointer cursor on hover
                    }} // close style object
                  >
                    Edit // label for edit action
                  </button>
                </td>
              </tr>
            ); // close data row return
          })}
        </tbody>
      </table>
      <footer // pagination footer container
        style={{ // style footer to align controls
          display: "flex", // align controls horizontally
          justifyContent: "space-between", // space out info text and controls
          alignItems: "center", // vertically center content
          padding: "16px", // add spacing around footer
        }} // close footer style
      >
        <span // text showing pagination summary
          style={{ // style text to match secondary tone
            color: "var(--text-secondary)", // muted text color
            fontSize: "0.9rem", // slightly smaller font size
          }} // close text style
        >
          Page {pagination.page} of {Math.max(1, Math.ceil((pagination.total || 0) / pagination.pageSize))} // display pagination summary text
        </span>
        <div // container for pagination buttons
          style={{ // style for button group
            display: "flex", // align buttons inline
            gap: "10px", // provide spacing between buttons
          }} // close button group style
        >
          <button // previous page button
            type="button" // button semantics
            onClick={() => onPageChange(Math.max(1, pagination.page - 1))} // move to previous page when clicked
            disabled={pagination.page <= 1} // disable when already on first page
            style={{ // button styling with disabled awareness
              padding: "8px 14px", // comfortable padding
              borderRadius: "999px", // pill shape consistent with other pagers
              border: "1px solid var(--surface-light)", // subtle border
              background: pagination.page <= 1 ? "var(--surface-light)" : "var(--surface)", // lighten when disabled
              color: "var(--text-secondary)", // muted text color
              cursor: pagination.page <= 1 ? "not-allowed" : "pointer", // update cursor when disabled
            }} // close button style
          >
            Prev // button label
          </button>
          <button // next page button
            type="button" // semantics for button
            onClick={() => onPageChange(pagination.page + 1)} // move to next page
            disabled={pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize)} // disable when on last page
            style={{ // style next button similar to prev
              padding: "8px 14px", // padding matches prev button
              borderRadius: "999px", // pill shaped button
              border: "1px solid var(--surface-light)", // subtle outline
              background: pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize) ? "var(--surface-light)" : "var(--surface)", // lighten background when disabled
              color: "var(--text-secondary)", // muted label color
              cursor: pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize) ? "not-allowed" : "pointer", // pointer only when clickable
            }} // close button style
          >
            Next // label for button
          </button>
        </div>
      </footer>
    </div>
  ); // close component return
} // close AccountTable definition
AccountTable.propTypes = { // prop type metadata to guide consumers
  accounts: PropTypes.arrayOf(PropTypes.object), // accounts array expected from parent
  loading: PropTypes.bool, // loading flag to show skeleton row
  pagination: PropTypes.shape({ // pagination object shape validation
    page: PropTypes.number, // current page number
    pageSize: PropTypes.number, // page size value
    total: PropTypes.number, // total available records
  }), // close pagination shape definition
  onPageChange: PropTypes.func, // callback when user changes page
  onSortChange: PropTypes.func, // callback when user toggles sort state
  sortState: PropTypes.shape({ // object describing active sort state
    field: PropTypes.string, // active sort column key
    direction: PropTypes.oneOf(["asc", "desc"]), // sort direction must be asc or desc
  }), // close sortState prop validation
  onSelectAccount: PropTypes.func, // callback invoked when user clicks actions
  selectedAccountId: PropTypes.string, // optional id used to highlight row selection
}; // close propTypes assignment
AccountTable.defaultProps = { // defaults ensure component still renders when props omitted
  accounts: [], // default to empty array of accounts
  loading: false, // assume not loading by default
  pagination: { page: 1, pageSize: 20, total: 0 }, // safe pagination defaults
  onPageChange: () => {}, // no-op page change handler by default
  onSortChange: () => {}, // no-op sort handler by default
  sortState: { field: "updated_at", direction: "desc" }, // default sort criteria
  onSelectAccount: () => {}, // default no-op for row actions
  selectedAccountId: null, // default to no row selected
}; // close defaultProps assignment
