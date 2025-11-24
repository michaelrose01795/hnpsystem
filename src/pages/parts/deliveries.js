import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";

const cardStyle = {
  backgroundColor: "white",
  borderRadius: "16px",
  padding: "24px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  border: "1px solid #ffe1e1",
};

const sectionTitleStyle = {
  fontSize: "1.2rem",
  fontWeight: 700,
  color: "#a00000",
  marginBottom: "16px",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const statusBadgeStyles = {
  ordering: { background: "rgba(59,130,246,0.15)", color: "#1d4ed8" },
  on_route: { background: "rgba(251,191,36,0.2)", color: "#92400e" },
  received: { background: "rgba(16,185,129,0.2)", color: "#047857" },
  partial: { background: "rgba(249,115,22,0.2)", color: "#c2410c" },
  cancelled: { background: "rgba(248,113,113,0.2)", color: "#b91c1c" },
};

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "ordering", label: "Ordering" },
  { value: "on_route", label: "On route" },
  { value: "received", label: "Received" },
  { value: "partial", label: "Partial" },
  { value: "cancelled", label: "Cancelled" },
];

const formatDate = (value) =>
  value ? new Date(value).toLocaleString(undefined, { hour12: false }) : "—";

const StatusBadge = ({ status }) => {
  const meta = statusBadgeStyles[status] || { background: "rgba(148,163,184,0.2)", color: "#475569" };
  const label = status ? status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "Unknown";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "0.8rem",
        fontWeight: 600,
        background: meta.background,
        color: meta.color,
      }}
    >
      {label}
    </span>
  );
};

export default function PartsDeliveriesPage() {
  const { user } = useUser();
  const roles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = roles.includes("parts") || roles.includes("parts manager");

  const [statusFilter, setStatusFilter] = useState("all");
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status: statusFilter, limit: "50" });
      const response = await fetch(`/api/parts/deliveries?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load deliveries");
      }
      setDeliveries(data.deliveries || []);
    } catch (err) {
      setError(err.message || "Unable to load deliveries");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>
          You do not have access to Parts deliveries.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
        <header>
          <p style={{ marginBottom: "6px", textTransform: "uppercase", color: "#a00000", letterSpacing: "0.08em" }}>
            Parts Department
          </p>
          <h1 style={{ margin: 0, color: "#d10000" }}>Inbound Deliveries</h1>
          <p style={{ marginTop: "6px", color: "#6b7280" }}>
            Track supplier drops, ETA updates, and delivery statuses in one place.
          </p>
        </header>

        <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#a00000", letterSpacing: "0.05em" }}>Filter by status</h2>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>
              Narrow the delivery list by workflow status.
            </p>
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={{
              minWidth: 180,
              padding: "10px",
              borderRadius: "10px",
              border: "1px solid #ffd1d1",
              fontWeight: 600,
              color: "#a00000",
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Deliveries</div>
          {error && <div style={{ color: "#b91c1c", marginBottom: "12px" }}>{error}</div>}
          {loading ? (
            <div style={{ color: "#6b7280" }}>Loading deliveries…</div>
          ) : deliveries.length === 0 ? (
            <div style={{ color: "#6b7280" }}>No deliveries recorded for this filter.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ ...tableStyle, fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ background: "#fff4f4", color: "#a00000" }}>
                    <th style={{ textAlign: "left", padding: "10px" }}>Supplier</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Items</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Dates</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id} style={{ borderBottom: "1px solid #ffe1e1" }}>
                      <td style={{ padding: "10px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 600 }}>{delivery.supplier || "Unknown supplier"}</div>
                        <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                          Ref: {delivery.order_reference || "—"}
                        </div>
                      </td>
                      <td style={{ padding: "10px", verticalAlign: "top" }}>
                        {(delivery.delivery_items || []).slice(0, 3).map((item) => (
                          <div key={item.id} style={{ marginBottom: "8px" }}>
                            <div style={{ fontWeight: 600 }}>
                              {item.part?.part_number} · {item.part?.name}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                              Ordered {item.quantity_ordered} · Received {item.quantity_received}
                            </div>
                          </div>
                        ))}
                        {(delivery.delivery_items || []).length > 3 && (
                          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                            +{delivery.delivery_items.length - 3} more lines…
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px", verticalAlign: "top" }}>
                        <div>Expected: {formatDate(delivery.expected_date)}</div>
                        <div>Received: {formatDate(delivery.received_date)}</div>
                        <div>Logged: {formatDate(delivery.created_at)}</div>
                      </td>
                      <td style={{ padding: "10px", verticalAlign: "top" }}>
                        <StatusBadge status={delivery.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
