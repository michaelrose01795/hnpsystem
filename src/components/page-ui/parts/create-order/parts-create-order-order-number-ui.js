// file location: src/components/page-ui/parts/create-order/parts-create-order-order-number-ui.js

export default function PartsOrderDetailUi(props) {
  const {
    DeliveryTab,
    InfoCell,
    InvoiceTab,
    PartsTab,
    StatusTab,
    SummaryPill,
    activeTab,
    containerStyle,
    error,
    formatCurrency,
    formatDeliveryStatus,
    formatInvoiceStatus,
    formatOrderStatus,
    handleDeliveryStatusChange,
    handleInvoiceStatusChange,
    infoGrid,
    loading,
    order,
    resolvedOrderNumber,
    sectionCard,
    setActiveTab,
    statusChip,
    statusError,
    statusSaving,
    tabButtonStyle,
    totals,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <div style={containerStyle}>
        <div className="app-section-card" style={sectionCard}>
          <p style={{
        margin: 0,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "var(--info-dark)",
        fontSize: "0.8rem"
      }}>
            Parts Order
          </p>
          <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "10px",
        justifyContent: "space-between"
      }}>
            <div>
              <h1 style={{
            margin: "6px 0 0",
            color: "var(--primary-dark)"
          }}>
                {order?.order_number || resolvedOrderNumber || "Loading…"}
              </h1>
              <p style={{
            margin: 0,
            color: "var(--grey-accent-dark)"
          }}>
                {order?.customer_name || "Customer"} · {order?.vehicle_reg || "No registration"}
              </p>
            </div>
            <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap"
        }}>
              {statusChip(formatOrderStatus(order?.status), order?.status === "complete" ? "success" : order?.status === "draft" ? "warning" : "info")}
              {statusChip(formatDeliveryStatus(order?.delivery_status), order?.delivery_status === "delivered" ? "success" : "info")}
              {statusChip(formatInvoiceStatus(order?.invoice_status), order?.invoice_status === "paid" ? "success" : order?.invoice_status === "issued" ? "info" : "warning")}
            </div>
          </div>
          <div style={{
        marginTop: "12px",
        display: "flex",
        gap: "16px",
        flexWrap: "wrap"
      }}>
            <SummaryPill label="Parts lines" value={totals.itemsCount} />
            <SummaryPill label="Subtotal" value={formatCurrency(totals.subtotal)} />
            <SummaryPill label="Invoice total" value={formatCurrency(order?.invoice_total || totals.subtotal)} />
          </div>
        </div>

        <div className="app-section-card" style={sectionCard}>
          <h2 style={{
        margin: "0 0 12px",
        color: "var(--primary-dark)"
      }}>Customer & Vehicle</h2>
          <div style={infoGrid}>
            <InfoCell label="Customer" value={order?.customer_name || "—"} />
            <InfoCell label="Phone" value={order?.customer_phone || "—"} />
            <InfoCell label="Email" value={order?.customer_email || "—"} />
            <InfoCell label="Vehicle Reg" value={order?.vehicle_reg || "—"} />
            <InfoCell label="Vehicle" value={order?.vehicle_make || order?.vehicle_model ? `${order.vehicle_make || ""} ${order.vehicle_model || ""}`.trim() : "—"} />
            <InfoCell label="VIN" value={order?.vehicle_vin || "—"} />
          </div>
          <InfoCell label="Address" value={order?.customer_address || "—"} fullWidth />
          <InfoCell label="Notes" value={order?.notes || "No notes recorded"} fullWidth />
        </div>

        <div className="app-section-card" style={sectionCard}>
          <div style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        marginBottom: "12px"
      }}>
            <button type="button" onClick={() => setActiveTab("status")} style={tabButtonStyle(activeTab === "status")}>
              Status
            </button>
            <button type="button" onClick={() => setActiveTab("parts")} style={tabButtonStyle(activeTab === "parts")}>
              Parts
            </button>
            <button type="button" onClick={() => setActiveTab("delivery")} style={tabButtonStyle(activeTab === "delivery")}>
              Delivery
            </button>
            <button type="button" onClick={() => setActiveTab("invoice")} style={tabButtonStyle(activeTab === "invoice")}>
              Invoice
            </button>
          </div>

          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading…</p> : error ? <p style={{
        color: "var(--danger)"
      }}>{error}</p> : !order ? <p style={{
        color: "var(--info)"
      }}>Parts order not found.</p> : <>
              {activeTab === "status" && order && <StatusTab order={order} onDeliveryChange={handleDeliveryStatusChange} onInvoiceChange={handleInvoiceStatusChange} saving={statusSaving} error={statusError} />}
              {activeTab === "parts" && <PartsTab items={order.items || []} orderNotes={order.notes} />}
              {activeTab === "delivery" && <DeliveryTab order={order} />}
              {activeTab === "invoice" && <InvoiceTab order={order} totals={totals} orderNumber={resolvedOrderNumber} /> // pass order number into invoice tab
        }
            </>}
        </div>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
