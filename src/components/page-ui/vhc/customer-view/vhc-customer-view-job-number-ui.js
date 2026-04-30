// file location: src/components/page-ui/vhc/customer-view/vhc-customer-view-job-number-ui.js

export default function VhcCustomerViewPageUi(props) {
  const {
    VhcDetailsPanel,
    handleBack,
    isCustomer,
    jobNumber,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <div style={{
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  }}>
        <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "12px"
    }}>
          {!isCustomer ? <button type="button" onClick={handleBack} style={{
        border: "1px solid var(--theme)",
        borderRadius: "var(--radius-sm)",
        padding: "8px 16px",
        background: "var(--surface)",
        fontWeight: 600,
        cursor: "pointer"
      }}>
              ← Back to workshop view
            </button> : null}
          <div style={{
        fontSize: "14px",
        color: "var(--info)"
      }}>Customer authorisation view</div>
        </div>

        <VhcDetailsPanel jobNumber={jobNumber} showNavigation={false} viewMode="customer" />
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
