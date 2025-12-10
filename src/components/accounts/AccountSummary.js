// file location: src/components/accounts/AccountSummary.js // identify module origin
import React from "react"; // import React to render JSX
import PropTypes from "prop-types"; // import PropTypes for runtime prop validation
const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }); // shared currency formatter that keeps display consistent with DMS rules
const summaryBlueprint = [ // describe the cards that form the summary ribbon
  { key: "openCount", label: "Open Accounts", emphasize: true }, // highlight total open accounts for quick health check
  { key: "frozenCount", label: "Frozen Accounts", emphasize: false }, // show number of frozen accounts to prompt action
  { key: "totalBalance", label: "Total Balance", emphasize: true, isCurrency: true }, // show total balance owed by customers
  { key: "overdueInvoices", label: "Overdue Invoices", emphasize: false }, // show overdue invoice count for follow-ups
  { key: "creditExposure", label: "Credit Exposure", emphasize: false, isCurrency: true }, // show total credit exposure for leadership
]; // close summaryBlueprint definition
const resolveValue = (key, value) => { // helper to convert summary values into display strings
  if (key.toLowerCase().includes("count")) { // treat metrics ending with count as integers
    return Number(value || 0).toLocaleString(); // format integer counts with locale separators
  } // close count branch
  return currencyFormatter.format(Number(value || 0)); // default to currency formatting for monetary metrics
}; // close resolveValue helper
export default function AccountSummary({ summary, onRefresh, showRefreshButton = true }) { // component that renders a horizontal set of summary cards
  const safeSummary = summary || {}; // default to empty object to avoid crashes when summary is undefined
  return ( // render the summary section container
    <section // semantic grouping for the summary row
      style={{ // inline styles maintain parity with other DMS cards
        background: "var(--surface)", // white card background per design
        border: "1px solid var(--surface-light)", // subtle border to delineate card
        borderRadius: "16px", // soft corners for modern look
        padding: "20px", // internal spacing for comfort
        display: "flex", // flex layout for cards
        flexWrap: "wrap", // wrap on smaller screens
        gap: "16px", // spacing between cards
        alignItems: "stretch", // ensure cards share equal height
      }} // close style object
    >
      <div // header row containing title and optional refresh action
        style={{ // style the header block
          flexBasis: "100%", // take full width above cards
          display: "flex", // align title and action horizontally
          alignItems: "center", // vertically center items
          justifyContent: "space-between", // spread title and button to edges
          marginBottom: "4px", // tighten spacing to summary grid
        }} // close header style object
      >
        <div // container for title text
          style={{ // styling for text block
            display: "flex", // align heading and subtitle stacked
            flexDirection: "column", // vertical stacking
            gap: "4px", // small space between title and subtitle
          }} // close title container style
        >
          <h2 // summary title element
            style={{ // style for heading text
              margin: 0, // remove default margin
              fontSize: "1.25rem", // medium heading size
              color: "var(--text-primary)", // use standard text color
            }} // close heading style
          >
            Accounts Snapshot // string label describing the section
          </h2>
          <p // subtitle element clarifying rollup scope
            style={{ // style for subtitle
              margin: 0, // remove margin for tight layout
              fontSize: "0.9rem", // smaller text for subtitle
              color: "var(--text-secondary)", // muted tone per UI guidelines
            }} // close subtitle style
          >
            Live balance and status metrics // textual description for context
          </p>
        </div>
        {showRefreshButton && ( // optionally render refresh button when requested
          <button // action button wrapper
            type="button" // ensure button semantics
            onClick={onRefresh} // wire click to provided refresh handler
            style={{ // style for refresh button
              padding: "10px 16px", // comfortable padding
              borderRadius: "999px", // pill shape matches DMS intent buttons
              border: "1px solid var(--primary)", // brand colored outline
              background: "var(--primary)", // filled button in brand red
              color: "white", // white text for contrast
              fontWeight: 600, // emphasize action
              cursor: "pointer", // pointer cursor for interactive hint
            }} // close button style
          >
            Refresh // button label text
          </button>
        )}
      </div>
      {summaryBlueprint.map((card) => { // iterate over blueprint to render each summary card
        const rawValue = safeSummary[card.key]; // read raw value from summary payload
        const displayValue = card.isCurrency ? currencyFormatter.format(Number(rawValue || 0)) : resolveValue(card.key, rawValue); // compute display value respecting currency flag
        return ( // render a card for each summary entry
          <article // semantic article for card content
            key={card.key} // stable key for React list rendering
            style={{ // styling for card wrapper
              flex: "1 1 180px", // allow equal width but wrap responsively
              borderRadius: "14px", // rounded corners
              border: "1px solid rgba(0,0,0,0.05)", // subtle outline
              padding: "16px", // internal spacing
              background: "var(--surface-light)", // faint grey background for contrast
            }} // close card style
          >
            <p // label text for the metric
              style={{ // style for label
                margin: 0, // remove default margin
                color: "var(--text-secondary)", // muted color per design
                fontSize: "0.8rem", // smaller label text
                letterSpacing: "0.05em", // uppercase letter spacing
                textTransform: "uppercase", // uppercase label style
              }} // close label style
            >
              {card.label} // render metric label from blueprint
            </p>
            <strong // value text element
              style={{ // style for value text
                marginTop: "8px", // space above value
                display: "block", // ensure strong spans full width
                fontSize: card.emphasize ? "1.8rem" : "1.4rem", // enlarge key metrics
                color: card.emphasize ? "var(--primary)" : "var(--text-primary)", // color emphasize metrics red
                fontWeight: card.emphasize ? 800 : 600, // bold emphasize metrics
              }} // close strong style
            >
              {displayValue} // show formatted metric value
            </strong>
          </article>
        ); // close card render
      })}
    </section>
  ); // close component return
} // close AccountSummary component definition
AccountSummary.propTypes = { // runtime prop type validation
  summary: PropTypes.object, // expect summary to be an object with numeric fields
  onRefresh: PropTypes.func, // optional refresh callback
  showRefreshButton: PropTypes.bool, // optional flag to hide refresh button
}; // close propTypes assignment
AccountSummary.defaultProps = { // sensible defaults ensure component does not crash without props
  summary: {}, // default summary object
  onRefresh: undefined, // refresh handler optional
  showRefreshButton: true, // show refresh button unless caller disables it
}; // close defaultProps assignment
