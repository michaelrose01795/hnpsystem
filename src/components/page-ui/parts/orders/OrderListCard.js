// file location: src/components/page-ui/parts/orders/OrderListCard.js
// Parts order list row. Moved verbatim from src/pages/jobs/index.js when the
// Orders tab became the standalone /order page - styling is unchanged.
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

const normalizeString = (value) =>
typeof value === "string" ? value.trim().toLowerCase() : "";

const getJobStatusBadgeTone = (status) => {
  const normalized = normalizeString(status);
  if (normalized.includes("released") || normalized.includes("complete") || normalized.includes("invoiced")) return "app-badge--success";
  if (normalized.includes("progress") || normalized.includes("checked")) return "app-badge--accent-soft";
  if (normalized.includes("waiting") || normalized.includes("hold") || normalized.includes("pending")) return "app-badge--warning";
  if (normalized.includes("cancel") || normalized.includes("failed")) return "app-badge--danger";
  return "app-badge--neutral";
};

const OrderListCard = ({ order, onNavigate, sectionKey, parentKey }) => {
  // top-layer
  const rowBackground = "var(--surface)";
  const items = order.requests || order.items || [];
  const totalItems = items.length;
  const deliveryLabel = order.delivery_type === "collection" ? "Collection" : "Delivery";
  const deliveryWindow = order.appointment ?
  order.appointment.time ?
  `${order.appointment.date} · ${order.appointment.time}` :
  order.appointment.date :
  "ETA not set";
  const primaryStatus =
  order.status || order.delivery_status || order.invoice_status || "Draft";
  const primaryStatusTone = getJobStatusBadgeTone(primaryStatus);

  return (
    // List-row container hosts onClick + hover handlers; row background is data-driven (rowBackground), so kept inline.
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="list-row"
      onClick={onNavigate}
      style={{
        padding: "0.75rem 0.9rem",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        backgroundColor: rowBackground,
        color: "var(--text-2)",
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem",
        cursor: "pointer",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease"
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.position = "relative";
        event.currentTarget.style.zIndex = "var(--hover-surface-z, 80)";
        event.currentTarget.style.transform = "translateY(-2px)";
        event.currentTarget.style.boxShadow = "none";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "translateY(0)";
        event.currentTarget.style.boxShadow = "none";
        event.currentTarget.style.zIndex = "0";
      }}>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "stretch",
          flexWrap: "wrap",
          gap: "12px"
        }}>
        
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", flex: "1 1 18rem", minWidth: "min(100%, 18rem)" }}>
          <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-1)" }}>
            {order.orderNumber}
          </span>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-accent)" }}>
            {order.customer || "Customer"}
          </span>
          <span style={{ fontSize: "15px", color: "var(--text-2)" }}>
            {order.makeModel || order.vehicle_reg || "Vehicle pending"}
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(7.5rem, 1fr))",
            gap: "0.55rem",
            fontSize: "0.92rem",
            flex: "999 1 28rem",
            minWidth: "min(100%, 24rem)",
            alignItems: "center"
          }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <span style={{ fontSize: "11px", color: "var(--text-accent)", textTransform: "uppercase", fontWeight: 600 }}>
              Fulfilment
            </span>
            <span style={{ color: "var(--text-1)", fontWeight: 500 }}>{deliveryLabel}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <span style={{ fontSize: "11px", color: "var(--text-accent)", textTransform: "uppercase", fontWeight: 600 }}>
              Scheduled
            </span>
            <span style={{ color: "var(--text-1)", fontWeight: 500 }}>{deliveryWindow}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <span style={{ fontSize: "11px", color: "var(--text-accent)", textTransform: "uppercase", fontWeight: 600 }}>
              Items
            </span>
            <span style={{ color: "var(--text-1)", fontWeight: 500 }}>
              {totalItems} line{totalItems === 1 ? "" : "s"}
            </span>
          </div>
          {order.invoice_total !== undefined &&
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
              <span style={{ fontSize: "11px", color: "var(--text-accent)", textTransform: "uppercase", fontWeight: 600 }}>
                Invoice Value
              </span>
              <span style={{ color: "var(--text-1)", fontWeight: 500 }}>
                GBP {Number(order.invoice_total || 0).toFixed(2)}
              </span>
            </div>
          }
        </div>
        <span
          style={{ flex: "0 1 auto", minWidth: "fit-content", alignSelf: "flex-start" }}
          className={`app-badge app-badge--uppercase ${primaryStatusTone}`}>
          
          {primaryStatus}
        </span>
      </div>
      {items.length > 0 &&
      <LayerTheme radius="var(--radius-xs)" padding="10px 12px" gap={undefined} style={{
        display: "grid",
        gridTemplateColumns: "minmax(8.5rem, auto) minmax(0, 1fr)",
        alignItems: "start",
        gap: "8px 12px"
      }}>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", minWidth: 0 }}>
            <span style={{ fontSize: "11px", color: "var(--text-accent)", textTransform: "uppercase", fontWeight: 700 }}>
              Parts Summary
            </span>
            <span className="app-badge app-badge--neutral">{items.length}</span>
          </div>
          <div style={{ color: "var(--text-1)", fontSize: "14px", fontWeight: 500, lineHeight: "1.45", minWidth: 0, overflowWrap: "anywhere" }}>
            {items.
          slice(0, 4).
          map((item) => item.part_name || item.part_number || "Part").
          join(" • ")}
            {items.length > 4 ? " +" + (items.length - 4) + " more" : ""}
          </div>
        </LayerTheme>
      }
    </DevLayoutSection>);

};

export default OrderListCard;

