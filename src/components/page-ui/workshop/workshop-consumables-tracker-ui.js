import { useEffect, useRef, useState } from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import LayerSurface from "@/components/ui/LayerSurface";
import Button from "@/components/ui/Button";
import DataTableShell from "@/components/ui/DataTableShell";

const textStyle = { color: "var(--text-1)" };
const mutedStyle = { color: "var(--surfaceTextMuted)" };
const headingStyle = { margin: 0, color: "var(--text-1)", fontSize: "1.1rem", lineHeight: 1.2 };
const panelGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 390px), 1fr))",
  gap: "var(--layout-card-gap)",
  alignItems: "start",
};
const equalHeightPanelGridStyle = {
  ...panelGridStyle,
  alignItems: "stretch",
  gridAutoRows: "1fr",
};
const fourRowListMinHeight = "calc(var(--table-row-height) + var(--table-row-height) + var(--table-row-height) + var(--table-row-height) + var(--layout-card-gap) + var(--layout-card-gap) + var(--layout-card-gap))";
const labelStyle = {
  color: "var(--surfaceTextMuted)",
  fontSize: "var(--text-caption)",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};
const modalCloseStyle = {
  position: "absolute",
  top: "var(--space-3)",
  right: "var(--space-3)",
};
const historyTableOffsetStyle = { marginTop: "10px" }; // Keeps the history table clear of the absolutely positioned Close button.
const itemHistoryLinkStyle = {
  color: "var(--accentText)",
  cursor: "pointer",
  fontWeight: 700,
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

function toneStyle(tone) {
  if (tone === "danger") return { background: "var(--danger-surface)", color: "var(--danger-text)" };
  if (tone === "warning") return { background: "var(--warning-surface)", color: "var(--warning-text)" };
  if (tone === "success" || tone === "safe") return { background: "var(--success-surface)", color: "var(--success-text)" };
  return { background: "var(--surface)", color: "var(--text-1)" };
}

// Tone -> canonical badge variant (families/badges.css). Inside .app-data-table
// the badge auto-sizes to --table-action-btn-height (32px), which is what the
// hand-rolled pill this replaced was hardcoding.
const BADGE_TONES = {
  danger: "app-badge--danger",
  warning: "app-badge--warning",
  success: "app-badge--success",
  safe: "app-badge--success",
  neutral: "app-badge--neutral",
};

function Status({ children, tone = "neutral" }) {
  return (
    <span className={`app-badge ${BADGE_TONES[tone] || BADGE_TONES.neutral}`}>
      {children}
    </span>
  );
}

function SectionHeader({ title, meta, actions, actionsStyle }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <h2 style={headingStyle}>{title}</h2>
        {meta ? <span style={{ ...mutedStyle, fontSize: "var(--text-body-sm)" }}>{meta}</span> : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center", ...actionsStyle }}>{actions}</div> : null}
    </div>
  );
}

function Metric({ label, value, detail, tone }) {
  return (
    <LayerSurface
      as="div"
      className="app-summary-item"
      radius="var(--radius-sm)"
      padding="8px 10px"
      gap="2px var(--space-sm)"
      role="listitem"
      style={{ flexDirection: "row", ...(detail ? { maxHeight: "none", minHeight: "52px" } : {}) }}
    >
      <span className="app-summary-label">{label}</span>
      <strong className="app-summary-value" style={tone ? { color: toneStyle(tone).color } : undefined}>{value}</strong>
      {detail ? <small style={{ flexBasis: "100%", ...mutedStyle, fontSize: "var(--text-caption)", lineHeight: 1.25 }}>{detail}</small> : null}
    </LayerSurface>
  );
}

function Empty({ children }) {
  return <p style={{ margin: 0, ...mutedStyle, padding: "var(--space-3) 0" }}>{children}</p>;
}

function ErrorMessage({ children }) {
  return children ? <div className="app-status-message app-status-message--danger" role="alert">{children}</div> : null;
}

function PriceChangeMessage({ value }) {
  if (value === null || value === undefined) return null;
  return (
    <div className={`app-status-message app-status-message--${value > 0 ? "warning" : "info"}`}>
      Latest unit cost is {Math.abs(value).toFixed(1)}% {value >= 0 ? "higher" : "lower"} than the previous order.
    </div>
  );
}

// Canonical table shell (families/tables.css `.app-table-scroll`, rendered by
// DataTableShell): no horizontal scroll, vertical scroll past ten 44px rows.
// This used to be a hand-rolled `overflow: auto` div with a ResizeObserver that
// re-measured header + ten rows — the CSS shell already does exactly that via
// max-height: calc((--table-visible-rows + 1) * --table-row-height).
function TableViewport({ children, label }) {
  return (
    <DataTableShell aria-label={label} tabIndex={0}>
      {children}
    </DataTableShell>
  );
}

function ListViewport({ children, label, reserveRows = false, visibleRows = 4 }) {
  const viewportRef = useRef(null);
  const [measuredMaxHeight, setMeasuredMaxHeight] = useState(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const measure = () => {
      const rows = Array.from(viewport.children).slice(0, visibleRows);
      const rowGap = Number.parseFloat(window.getComputedStyle(viewport).rowGap) || 0;
      const rowsHeight = rows.reduce((total, row) => total + row.getBoundingClientRect().height, 0);
      const nextHeight = Math.ceil(rowsHeight + Math.max(0, rows.length - 1) * rowGap);
      setMeasuredMaxHeight((current) => current === nextHeight ? current : nextHeight);
    };

    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    Array.from(viewport.children).forEach((row) => observer?.observe(row));
    return () => observer?.disconnect();
  });

  return (
    <div
      ref={viewportRef}
      aria-label={label}
      tabIndex={0}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--layout-card-gap)",
        overflowY: "auto",
        minHeight: reserveRows ? fourRowListMinHeight : 0,
        ...(measuredMaxHeight === null ? {} : { maxHeight: `${measuredMaxHeight}px` }),
      }}
    >
      {children}
    </div>
  );
}

function Trend({ rows, formatCurrency }) {
  const maximum = Math.max(1, ...rows.flatMap((row) => [Number(row.spend) || 0, Number(row.budget) || 0]));
  if (!rows.length) return <Empty>No historical budget data is available.</Empty>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${rows.length}, minmax(44px, 1fr))`, gap: "var(--space-sm)", minHeight: "150px", alignItems: "end" }}>
      {rows.map((row) => (
        <div key={row.key} title={`${row.label}: ${formatCurrency(row.spend)} spent / ${formatCurrency(row.budget)} budget`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-sm)", minWidth: 0 }}>
          <div style={{ height: "104px", width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "4px" }}>
            <span style={{ width: "38%", minHeight: row.budget ? "4px" : 0, height: `${Math.max(0, row.budget / maximum * 100)}%`, background: "var(--surfaceTextMuted)", borderRadius: "var(--radius-xs) var(--radius-xs) 0 0" }} />
            <span style={{ width: "38%", minHeight: row.spend ? "4px" : 0, height: `${Math.max(0, row.spend / maximum * 100)}%`, background: row.budget && row.spend > row.budget ? "var(--danger-base)" : "var(--primary)", borderRadius: "var(--radius-xs) var(--radius-xs) 0 0" }} />
          </div>
          <span style={{ ...labelStyle, textTransform: "none", letterSpacing: 0 }}>{row.label}</span>
        </div>
      ))}
    </div>
  );
}

function HistoryRows({ item, formatCurrency, formatDate }) {
  const history = item?.orderHistory || [];
  if (!history.length) return <Empty>No previous orders recorded.</Empty>;
  return (
    <TableViewport label="Consumable order history">
      <table className="app-data-table app-data-table--rounded">
        <thead><tr><th>Item</th><th data-table-cell="nowrap">Qty</th><th data-table-cell="nowrap">Unit</th><th data-table-cell="nowrap">Total</th><th>Supplier</th><th data-table-cell="nowrap">Date</th></tr></thead>
        <tbody>{history.map((log, index) => (
          <tr key={`${log.date}-${index}`}>
            <td>{log.itemName || item.name}</td>
            <td data-table-cell="nowrap">{Number(log.quantity).toLocaleString()}</td>
            <td data-table-cell="nowrap">{formatCurrency(log.unitCost)}</td>
            <td data-table-cell="nowrap">{formatCurrency(log.totalCost)}</td>
            <td>{log.supplier || "—"}</td>
            <td data-table-cell="nowrap">{formatDate(log.date)}</td>
          </tr>
        ))}</tbody>
      </table>
    </TableViewport>
  );
}

export default function ConsumablesTrackerPageUi(props) {
  const {
    PageShell, ContentWidth, InlineLoading, Link, SearchBar, StockCheckPopup,
    alerts, budgetInput, budgetSaveError, budgetSaveMessage, budgetSaving,
    bulkOrderError, bulkOrderItems, bulkOrderLoading, cardStyle, closeBulkOrder,
    closeHistoryModal, closeOrderModal, consumablesError, criticalItems,
    dashboardSummary, dbUserId, duplicateModalStyle,
    fetchTechRequests, filteredConsumables, financialError, financialLoading,
    financialSummary, formatCurrency, formatDate, formattedBudgetUpdatedAt,
    groupedRequests, handleBudgetInputChange, handleBudgetSave,
    handleBulkOrderChange, handleBulkOrderSubmit, handleEditedOrder,
    handleMonthValueChange, handleOrderFormChange, handleRequestArrived,
    handleRequestOrder, historyModalConsumable, historyModalStyle,
    loadingConsumables, logsError, logsLoading, logsSummary, maxMonthValue,
    monthLabel, monthlyLogs, MonthPickerField, openBulkOrder, openHistoryModal,
    openOrderModal, orderForm, orderModalConsumable, orderModalError,
    orderModalLoading, orderModalStyle, orderingRequestId,
    potentialDuplicates, previewLogs, recentActivity, requestsError,
    requestsLoading, searchQuery, selectedConsumableIds, selectedMonthValue,
    setSearchQuery, setShowDuplicateModal, setShowStockCheck,
    showDuplicateModal, showStockCheck, supplierSpend, techRequests,
    toggleConsumableSelection, totals,
  } = props;

  if (props.view === "section1") {
    return (
      <LayerSurface style={{ maxWidth: "720px", margin: "var(--space-xl) auto", textAlign: "center" }}>
        <h1 style={{ margin: 0, ...textStyle }}>Workshop Manager access only</h1>
        <p style={{ margin: 0, ...mutedStyle }}>This consumables workspace is limited to workshop management roles.</p>
        <Link href="/newsfeed" className="app-btn app-btn--primary" style={{ alignSelf: "center", textDecoration: "none" }}>Return to news feed</Link>
      </LayerSurface>
    );
  }

  if (props.view !== "section2") return null;

  const scheduled = filteredConsumables;
  const availableCount = Math.max(0, dashboardSummary.active - dashboardSummary.low - dashboardSummary.out);
  const selectedSuppliers = new Set(
    filteredConsumables.filter((item) => selectedConsumableIds.has(item.id)).map((item) => (item.orderHistory?.[0]?.supplier || item.supplier || "").trim().toLowerCase()).filter(Boolean)
  );
  const bulkSelectionValid = selectedConsumableIds.size > 1 && selectedSuppliers.size === 1;
  const budgetTone = totals.monthlyBudget > 0 && totals.percentageUsed >= 100 ? "danger" : totals.monthlyBudget > 0 && totals.percentageUsed >= 80 ? "warning" : "safe";

  return (
    <PageShell sectionKey="workshop-consumables-tracker-shell">
      <ContentWidth sectionKey="workshop-consumables-tracker-content" parentKey="workshop-consumables-tracker-shell" widthMode="content">
        {showDuplicateModal && potentialDuplicates.length > 0 ? (
          <div className="popup-backdrop">
            <div className="popup-card" style={duplicateModalStyle} role="dialog" aria-modal="true" aria-label="Potential duplicate consumables">
              <h2 style={headingStyle}>Potential duplicate consumables</h2>
              <p style={{ margin: 0, ...mutedStyle }}>These names normalise to the same value. The tracker still preserves each source record.</p>
              <ul style={{ margin: 0, paddingLeft: "var(--space-lg)", ...mutedStyle }}>{potentialDuplicates.map((entry) => <li key={entry.normalized}>{entry.names.join(" / ")}</li>)}</ul>
              <Button type="button" onClick={() => setShowDuplicateModal(false)} variant="primary" style={{ alignSelf: "flex-end" }}>Dismiss</Button>
            </div>
          </div>
        ) : null}

        {showStockCheck ? <StockCheckPopup open={showStockCheck} onClose={() => setShowStockCheck(false)} isManager technicianId={dbUserId} onRequestsSubmitted={fetchTechRequests} /> : null}

        {historyModalConsumable ? (
          <div className="popup-backdrop">
            <div className="popup-card" style={historyModalStyle} role="dialog" aria-modal="true">
              <Button type="button" variant="secondary" size="sm" onClick={closeHistoryModal} style={modalCloseStyle}>Close</Button>
              <h2 style={headingStyle}>{historyModalConsumable.name} order history</h2>
              <PriceChangeMessage value={historyModalConsumable.priceChange} />
              <div style={historyTableOffsetStyle}>
                <HistoryRows item={historyModalConsumable} formatCurrency={formatCurrency} formatDate={formatDate} />
              </div>
            </div>
          </div>
        ) : null}

        {orderModalConsumable ? (
          <div className="popup-backdrop">
            <div className="popup-card" style={orderModalStyle} role="dialog" aria-modal="true">
              <Button type="button" variant="secondary" size="sm" onClick={closeOrderModal} style={modalCloseStyle}>Close</Button>
              <h2 style={headingStyle}>Order {orderModalConsumable.name}</h2>
              <p style={{ margin: 0, ...mutedStyle }}>The last order is pre-filled. Review or change each detail before saving.</p>
              <PriceChangeMessage value={orderModalConsumable.priceChange} />
              {previewLogs.length ? <HistoryRows item={{ ...orderModalConsumable, orderHistory: previewLogs }} formatCurrency={formatCurrency} formatDate={formatDate} /> : null}
              <form onSubmit={handleEditedOrder} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--layout-card-gap)" }}>
                <label style={{ ...textStyle, fontWeight: 600 }}>Quantity
                  <input className="app-input" type="number" min="1" value={orderForm.quantity} onChange={handleOrderFormChange("quantity")} required />
                </label>
                <label style={{ ...textStyle, fontWeight: 600 }}>Unit cost (£)
                  <input className="app-input" type="number" min="0" step="0.01" value={orderForm.unitCost} onChange={handleOrderFormChange("unitCost")} required />
                </label>
                <label style={{ ...textStyle, fontWeight: 600 }}>Supplier
                  <input className="app-input" type="text" value={orderForm.supplier} onChange={handleOrderFormChange("supplier")} required />
                </label>
                <label style={{ ...textStyle, fontWeight: 600 }}>Order date
                  <input className="app-input" type="date" value={orderForm.orderDate} onChange={handleOrderFormChange("orderDate")} required />
                </label>
                <ErrorMessage>{orderModalError}</ErrorMessage>
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                  <Button type="submit" variant="primary" busy={orderModalLoading}>Place order</Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {bulkOrderItems.length ? (
          <div className="popup-backdrop">
            <div className="popup-card" style={{ ...historyModalStyle, maxWidth: "980px" }} role="dialog" aria-modal="true">
              <Button type="button" variant="secondary" size="sm" onClick={closeBulkOrder} style={modalCloseStyle}>Close</Button>
              <h2 style={headingStyle}>Grouped supplier order</h2>
              <p style={{ margin: 0, ...mutedStyle }}>Every line creates its own order record. All lines must share one supplier.</p>
              <form onSubmit={handleBulkOrderSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)" }}>
                <TableViewport label="Grouped consumables order">
                  <table className="app-data-table app-data-table--rounded">
                    <thead><tr><th>Item</th><th data-table-cell="nowrap">Quantity</th><th data-table-cell="nowrap">Unit cost</th><th>Supplier</th><th data-table-cell="nowrap">Date</th><th data-table-cell="nowrap">Projected</th></tr></thead>
                    <tbody>{bulkOrderItems.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.name}</strong>{item.priceChange !== null ? <small style={{ display: "block", ...mutedStyle }}>{item.priceChange >= 0 ? "+" : ""}{item.priceChange.toFixed(1)}% latest price</small> : null}</td>
                        <td><input className="app-input" type="number" min="1" value={item.quantity} onChange={(event) => handleBulkOrderChange(item.id, "quantity", event.target.value)} required /></td>
                        <td><input className="app-input" type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => handleBulkOrderChange(item.id, "unitCost", event.target.value)} required /></td>
                        <td><input className="app-input" type="text" value={item.supplier} onChange={(event) => handleBulkOrderChange(item.id, "supplier", event.target.value)} required /></td>
                        <td><input className="app-input" type="date" value={item.orderDate} onChange={(event) => handleBulkOrderChange(item.id, "orderDate", event.target.value)} required /></td>
                        <td data-table-cell="nowrap">{formatCurrency(Number(item.quantity) * Number(item.unitCost))}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </TableViewport>
                <ErrorMessage>{bulkOrderError}</ErrorMessage>
                <Button type="submit" variant="primary" busy={bulkOrderLoading} style={{ alignSelf: "flex-end" }}>Place grouped order</Button>
              </form>
            </div>
          </div>
        ) : null}

        <LayerTheme sectionKey="workshop-consumables-command" parentKey="workshop-consumables-tracker-content" style={cardStyle}>
          <SectionHeader
            title="Consumables control"
            meta="Purchasing, stock health and workshop requests"
            actions={<>
              <Button type="button" variant="primary" size="sm" onClick={() => setShowStockCheck(true)}>Stock check</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => document.getElementById("scheduled-consumables")?.scrollIntoView({ behavior: "smooth" })}>Schedule order</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => document.getElementById("consumable-requests")?.scrollIntoView({ behavior: "smooth" })}>Requests</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => document.getElementById("consumable-order-history")?.scrollIntoView({ behavior: "smooth" })}>Order history</Button>
            </>}
          />
          <div className="app-summary-section">
            <div className="app-summary-grid" role="list" aria-label="Consumables control summary">
              <Metric label="Active items" value={dashboardSummary.active.toLocaleString()} />
              <Metric label="Low stock" value={dashboardSummary.low.toLocaleString()} tone={dashboardSummary.low ? "warning" : "safe"} />
              <Metric label="Out of stock" value={dashboardSummary.out.toLocaleString()} tone={dashboardSummary.out ? "danger" : "safe"} />
              <Metric label="Requests to review" value={dashboardSummary.requestsNeedingAttention.toLocaleString()} tone={dashboardSummary.requestsNeedingAttention ? "warning" : "safe"} />
              <Metric label="Scheduled value" value={formatCurrency(dashboardSummary.scheduledValue)} />
            </div>
          </div>
        </LayerTheme>

        <div style={equalHeightPanelGridStyle}>
          <LayerTheme sectionKey="workshop-consumables-stock-overview" parentKey="workshop-consumables-tracker-content" style={cardStyle}>
            <SectionHeader title="Stock overview" meta={`${dashboardSummary.active} active items`} />
            <div className="app-summary-section">
              <div className="app-summary-grid" role="list" aria-label="Stock overview summary">
                <Metric label="Available" value={availableCount.toLocaleString()} tone="safe" />
                <Metric label="Low" value={dashboardSummary.low.toLocaleString()} tone="warning" />
                <Metric label="Out" value={dashboardSummary.out.toLocaleString()} tone="danger" />
              </div>
            </div>
            <div style={{ display: "flex", height: "10px", overflow: "hidden", borderRadius: "var(--radius-pill)" }} aria-label="Stock health distribution">
              <span style={{ width: `${dashboardSummary.active ? availableCount / dashboardSummary.active * 100 : 0}%`, background: "var(--success-base)" }} />
              <span style={{ width: `${dashboardSummary.active ? dashboardSummary.low / dashboardSummary.active * 100 : 0}%`, background: "var(--warning-base)" }} />
              <span style={{ width: `${dashboardSummary.active ? dashboardSummary.out / dashboardSummary.active * 100 : 0}%`, background: "var(--danger-base)" }} />
            </div>
            <h3 style={{ ...headingStyle, fontSize: "1rem" }}>Critical items</h3>
            {loadingConsumables ? <InlineLoading width={150} label="Loading stock" /> : criticalItems.length ? criticalItems.slice(0, 4).map((item) => (
              <LayerSurface key={item.id} padding="var(--space-3)" gap="var(--space-sm)" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={textStyle}>{item.name}</strong>
                  <div style={{ ...mutedStyle, fontSize: "var(--text-caption)", marginTop: "4px" }}>
                    Stock {item.stockQuantity.toLocaleString()} · Target {item.preferredStock?.toLocaleString() || "—"} · {item.daysRemaining === null ? "Cover unavailable" : `${item.daysRemaining} days cover`}
                  </div>
                </div>
                <Status tone={item.stockTone}>{item.stockStatus}</Status>
              </LayerSurface>
            )) : <Empty>No critical stock items.</Empty>}
            <ErrorMessage>{consumablesError}</ErrorMessage>
          </LayerTheme>

          <LayerTheme sectionKey="workshop-consumables-budget" parentKey="workshop-consumables-tracker-content" style={cardStyle}>
            <SectionHeader title="Budget and spend" meta={monthLabel} />
            <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "flex-end" }}>
              <MonthPickerField label="Reporting month" value={selectedMonthValue} max={maxMonthValue} onChange={handleMonthValueChange} style={{ flex: "1 1 280px", minWidth: "min(100%, 260px)" }} />
              <label style={{ flex: "0 0 140px", minWidth: 0, ...textStyle, fontWeight: 600 }}>Monthly budget (£)
                <input className="app-input" type="number" min="0" step="0.01" value={budgetInput} onChange={handleBudgetInputChange} />
              </label>
              <Button type="button" variant="primary" size="sm" onClick={handleBudgetSave} busy={budgetSaving} style={{ flex: "0 0 auto" }}>Save budget</Button>
            </div>
            <ErrorMessage>{financialError || budgetSaveError}</ErrorMessage>
            {budgetSaveMessage ? <div className="app-status-message app-status-message--success">{budgetSaveMessage}</div> : null}
            {formattedBudgetUpdatedAt ? <span style={{ ...mutedStyle, fontSize: "var(--text-caption)" }}>Budget updated {formattedBudgetUpdatedAt}</span> : null}
            <div className="app-summary-section">
              <div className="app-summary-grid" role="list" aria-label="Budget and spend summary">
                <Metric label="Budget" value={financialLoading ? "…" : formatCurrency(totals.monthlyBudget)} />
                <Metric label="Spend to date" value={financialLoading ? "…" : formatCurrency(totals.monthSpend)} tone={budgetTone} />
                <Metric label="Projected spend" value={financialLoading ? "…" : formatCurrency(totals.projectedSpend)} />
                <Metric label="Expected remaining" value={financialLoading ? "…" : formatCurrency(totals.expectedRemaining)} tone={totals.expectedRemaining < 0 ? "danger" : "safe"} />
                <Metric label="Budget used" value={financialLoading ? "…" : `${Math.round(totals.percentageUsed)}%`} tone={budgetTone} />
              </div>
            </div>
            <Trend rows={financialSummary.trend || []} formatCurrency={formatCurrency} />
            <div style={{ display: "flex", gap: "var(--space-md)", ...mutedStyle, fontSize: "var(--text-caption)" }}><span>Grey: budget</span><span style={{ color: "var(--accentText)" }}>Accent: spend</span></div>
          </LayerTheme>
        </div>

        <div style={equalHeightPanelGridStyle}>
          <LayerTheme sectionKey="workshop-consumables-alerts" parentKey="workshop-consumables-tracker-content" style={{ ...cardStyle, height: "100%", minHeight: 0 }}>
            <SectionHeader title="Alerts and notifications" meta={`${alerts.length} active`} />
            <ListViewport label="Consumables alerts" reserveRows>
              {alerts.length ? alerts.map((alert, index) => <div key={`${alert.label}-${index}`} className={`app-status-message app-status-message--${alert.tone}`}>{alert.label}</div>) : <div className="app-status-message app-status-message--success">No consumable alerts need attention.</div>}
            </ListViewport>
          </LayerTheme>
          <LayerTheme sectionKey="workshop-consumables-suppliers" parentKey="workshop-consumables-tracker-content" style={{ ...cardStyle, height: "100%", minHeight: 0 }}>
            <SectionHeader title="Supplier spend" meta={monthLabel} />
            <ErrorMessage>{logsError}</ErrorMessage>
            {logsLoading ? <InlineLoading width={140} label="Loading supplier spend" /> : (
              <ListViewport label="Supplier spend by supplier" reserveRows>
                {supplierSpend.length ? supplierSpend.map((supplier) => (
                  <div key={supplier.supplier} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "var(--space-3)", alignItems: "center", minHeight: "var(--table-row-height)" }}>
                    <span style={textStyle}>{supplier.supplier}</span><strong style={{ ...textStyle, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(supplier.spend)}</strong>
                  </div>
                )) : <Empty>No supplier spend for this month.</Empty>}
              </ListViewport>
            )}
          </LayerTheme>
        </div>

        <LayerTheme id="scheduled-consumables" sectionKey="workshop-consumables-scheduled" parentKey="workshop-consumables-tracker-content" style={cardStyle}>
          <SectionHeader
            title="Scheduled consumables"
            meta={loadingConsumables ? "Loading" : `${scheduled.length} items`}
            actionsStyle={{ flex: "1 1 460px", minWidth: 0, flexWrap: "nowrap", justifyContent: "flex-end" }}
            actions={<>
              <SearchBar value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onClear={() => setSearchQuery("")} placeholder="Search stock or supplier" style={{ flex: "1 1 200px", minWidth: 0, maxWidth: "420px" }} />
              <Button type="button" variant="primary" size="sm" onClick={openBulkOrder} disabled={!bulkSelectionValid} style={{ flexShrink: 0 }}>Order selected ({selectedConsumableIds.size})</Button>
            </>}
          />
          {selectedConsumableIds.size > 1 && !bulkSelectionValid ? <div className="app-status-message app-status-message--warning">Select at least two items with the same recorded supplier to create a grouped order.</div> : null}
          <ErrorMessage>{consumablesError}</ErrorMessage>
          <TableViewport label="Scheduled consumables">
            <table className="app-data-table app-data-table--rounded">
              <thead><tr><th data-table-cell="nowrap">Select</th><th>Item</th><th>Supplier</th><th data-table-cell="nowrap">Stock</th><th data-table-cell="nowrap">Min / target</th><th data-table-cell="nowrap">Days left</th><th data-table-cell="nowrap">Suggested</th><th data-table-cell="nowrap">Unit cost</th><th data-table-cell="nowrap">Projected</th><th data-table-cell="nowrap">Stock status</th><th data-table-cell="nowrap">Schedule</th><th data-table-cell="nowrap">Priority</th><th data-table-cell="nowrap">Actions</th></tr></thead>
              <tbody>{scheduled.map((item) => {
                const projectedQuantity = item.suggestedOrderQuantity ?? item.estimatedQuantity ?? 0;
                const priority = item.stockStatus === "Out" || item.scheduleStatus.label === "Overdue" ? "Urgent" : item.stockStatus === "Low" || item.scheduleStatus.label === "Coming Up" ? "Review" : "Routine";
                return (
                  <tr key={item.id}>
                    <td data-table-cell="nowrap"><label style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "44px", height: "44px" }}><input className="app-toggle--checkbox" type="checkbox" checked={selectedConsumableIds.has(item.id)} onChange={() => toggleConsumableSelection(item.id)} aria-label={`Select ${item.name}`} /></label></td>
                    <td><a href="#consumable-order-history" aria-haspopup="dialog" aria-label={`View order history for ${item.name}`} onClick={(event) => { event.preventDefault(); openHistoryModal(item); }} style={itemHistoryLinkStyle}>{item.name}</a></td>
                    <td>{item.supplier || "—"}</td>
                    <td data-table-cell="nowrap">{item.stockQuantity.toLocaleString()}</td>
                    <td data-table-cell="nowrap">{item.minimumStock === null ? "—" : item.minimumStock.toLocaleString()} / {item.preferredStock?.toLocaleString() || "—"}</td>
                    <td data-table-cell="nowrap">{item.daysRemaining === null ? "—" : item.daysRemaining}</td>
                    <td data-table-cell="nowrap">{item.suggestedOrderQuantity === null ? "—" : item.suggestedOrderQuantity.toLocaleString()}</td>
                    <td data-table-cell="nowrap">{formatCurrency(item.unitCost)}</td>
                    <td data-table-cell="nowrap">{formatCurrency(projectedQuantity * Number(item.unitCost || 0))}</td>
                    <td data-table-cell="nowrap"><Status tone={item.stockTone}>{item.stockStatus}</Status></td>
                    <td data-table-cell="nowrap"><Status tone={item.scheduleStatus.tone}>{item.scheduleStatus.label === "Coming Up" ? "Order now" : item.scheduleStatus.label}</Status></td>
                    <td data-table-cell="nowrap"><Status tone={priority === "Urgent" ? "danger" : priority === "Review" ? "warning" : "safe"}>{priority}</Status></td>
                    <td data-table-cell="nowrap"><div style={{ display: "flex", gap: "var(--space-sm)" }}><Button type="button" size="xs" variant="primary" onClick={() => openOrderModal(item)}>{item.orderHistory.length ? "Repeat" : "Order"}</Button></div></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </TableViewport>
          {!loadingConsumables && !scheduled.length ? <Empty>No consumables match this search.</Empty> : null}
        </LayerTheme>

        <LayerTheme id="consumable-requests" sectionKey="workshop-consumables-requests" parentKey="workshop-consumables-tracker-content" style={cardStyle}>
          <SectionHeader title="Technician requests" meta={requestsLoading ? "Loading" : `${techRequests.length} request records · ${groupedRequests.length} grouped items`} />
          <ErrorMessage>{requestsError}</ErrorMessage>
          <div className="app-summary-section">
            <div className="app-summary-grid" role="list" aria-label="Technician request summary">
              {groupedRequests.slice(0, 6).map((group) => (
                <Metric
                  key={group.key}
                  label={group.itemName}
                  value={`${group.activeQuantity.toLocaleString()} open`}
                  detail={`${group.totalQuantity.toLocaleString()} requested · ${group.fulfilledQuantity.toLocaleString()} fulfilled · ${group.requests.length} record${group.requests.length === 1 ? "" : "s"}`}
                />
              ))}
            </div>
          </div>
          <TableViewport label="Technician consumable requests">
            <table className="app-data-table app-data-table--rounded">
              <thead><tr><th>Item</th><th data-table-cell="nowrap">Quantity</th><th>Technician</th><th data-table-cell="nowrap">Requested</th><th data-table-cell="nowrap">Status</th><th data-table-cell="nowrap">Urgency</th><th data-table-cell="nowrap">Action</th></tr></thead>
              <tbody>{techRequests.map((request) => {
                const urgency = request.status === "urgent" ? "Urgent" : request.status === "pending" ? "Review" : "Normal";
                return (
                  <tr key={request.id}>
                    <td>{request.itemName || "Consumable"}</td><td data-table-cell="nowrap">{Number(request.quantity).toLocaleString()}</td><td>{request.requestedByName || "—"}</td><td data-table-cell="nowrap">{formatDate(request.requestedAt)}</td>
                    <td data-table-cell="nowrap"><Status tone={request.status === "rejected" ? "danger" : request.status === "arrived" ? "safe" : request.status === "urgent" ? "warning" : "neutral"}>{(request.status || "pending").replace(/^./, (letter) => letter.toUpperCase())}</Status></td>
                    <td data-table-cell="nowrap"><Status tone={urgency === "Urgent" ? "danger" : urgency === "Review" ? "warning" : "safe"}>{urgency}</Status></td>
                    <td data-table-cell="nowrap">{request.status === "pending" || request.status === "urgent" ? <Button type="button" size="xs" variant="primary" busy={orderingRequestId === request.id} onClick={() => handleRequestOrder(request)}>Order</Button> : request.status === "ordered" ? <Button type="button" size="xs" variant="primary" busy={orderingRequestId === request.id} onClick={() => handleRequestArrived(request)}>Arrived</Button> : request.status === "arrived" ? <Button type="button" size="xs" variant="secondary" busy={orderingRequestId === request.id} onClick={() => handleRequestOrder(request)}>Reorder</Button> : <span style={mutedStyle}>No action</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </TableViewport>
          {!requestsLoading && !techRequests.length ? <Empty>No technician requests recorded.</Empty> : null}
        </LayerTheme>

        <div style={equalHeightPanelGridStyle}>
          <LayerTheme sectionKey="workshop-consumables-top-requested" parentKey="workshop-consumables-tracker-content" style={{ ...cardStyle, height: "100%", minHeight: 0 }}>
            <SectionHeader title="Top requested items" meta="All available request history" />
            <ListViewport label="Top requested consumables" reserveRows>
              {groupedRequests.length ? groupedRequests.map((group, index) => (
                <div key={group.key} style={{ display: "grid", gridTemplateColumns: "32px minmax(0, 1fr) auto", gap: "var(--space-3)", alignItems: "center", minHeight: "var(--table-row-height)" }}>
                  <strong style={{ color: "var(--accentText)", fontVariantNumeric: "tabular-nums" }}>{index + 1}</strong><span style={textStyle}>{group.itemName}</span><span style={mutedStyle}>{group.totalQuantity} total · {group.activeQuantity} open</span>
                </div>
              )) : <Empty>No request history is available.</Empty>}
            </ListViewport>
          </LayerTheme>
          <LayerTheme sectionKey="workshop-consumables-activity" parentKey="workshop-consumables-tracker-content" style={{ ...cardStyle, height: "100%", minHeight: 0 }}>
            <SectionHeader title="Recent activity" meta="Orders and requests" />
            <ListViewport label="Recent consumables activity" reserveRows>
              {recentActivity.length ? recentActivity.map((activity) => (
                <div key={activity.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "var(--space-3)", alignItems: "start", minHeight: "var(--table-row-height)" }}>
                  <div><strong style={textStyle}>{activity.label}</strong><div style={{ ...mutedStyle, fontSize: "var(--text-caption)", marginTop: "4px" }}>{activity.detail}</div></div><time style={{ ...mutedStyle, fontSize: "var(--text-caption)" }}>{formatDate(activity.date)}</time>
                </div>
              )) : <Empty>No recent activity is available.</Empty>}
            </ListViewport>
          </LayerTheme>
        </div>

        <LayerTheme id="consumable-order-history" sectionKey="workshop-consumables-order-history" parentKey="workshop-consumables-tracker-content" style={cardStyle}>
          <SectionHeader title="Order history" meta={`${monthLabel} · ${logsSummary.orders} orders · ${formatCurrency(logsSummary.spend)}`} />
          <ErrorMessage>{logsError}</ErrorMessage>
          {logsLoading ? <InlineLoading width={160} label="Loading order history" /> : monthlyLogs.length ? (
            <TableViewport label="Monthly consumable order history"><table className="app-data-table app-data-table--rounded"><thead><tr><th data-table-cell="nowrap">Date</th><th>Item</th><th>Supplier</th><th data-table-cell="nowrap">Quantity</th><th data-table-cell="nowrap">Unit cost</th><th data-table-cell="nowrap">Total</th></tr></thead><tbody>{monthlyLogs.map((order) => <tr key={order.id}><td data-table-cell="nowrap">{formatDate(order.date)}</td><td>{order.itemName || "Consumable"}</td><td>{order.supplier || "—"}</td><td data-table-cell="nowrap">{Number(order.quantity).toLocaleString()}</td><td data-table-cell="nowrap">{formatCurrency(order.unitCost)}</td><td data-table-cell="nowrap">{formatCurrency(order.totalValue || Number(order.quantity) * Number(order.unitCost))}</td></tr>)}</tbody></table></TableViewport>
          ) : <Empty>No orders were recorded for this month.</Empty>}
        </LayerTheme>
      </ContentWidth>
    </PageShell>
  );
}
