// file location: src/pages/parts/manager.js
import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";

const cardStyle = {
  backgroundColor: "white",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "0 10px 30px rgba(255,64,64,0.1)",
  border: "1px solid #ffe1e1",
};

const sectionTitleStyle = {
  fontSize: "1.1rem",
  fontWeight: 600,
  color: "#ff4040",
  marginBottom: "12px",
};

const formatCurrency = (value) =>
  value !== null && value !== undefined
    ? `£${Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "£0.00";

function PartsManagerDashboard() {
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [inventory, setInventory] = useState([]);
  const [inventoryError, setInventoryError] = useState("");
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const [deliveries, setDeliveries] = useState([]);
  const [deliveriesError, setDeliveriesError] = useState("");
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const response = await fetch("/api/parts/summary");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load summary");
      }

      setSummary(data.summary || null);
    } catch (err) {
      setSummaryError(err.message || "Unable to load summary");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError("");
    try {
      const query = new URLSearchParams({
        limit: "200",
        includeInactive: "false",
      });
      const response = await fetch(`/api/parts/inventory?${query}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load inventory");
      }

      setInventory(data.parts || []);
    } catch (err) {
      setInventoryError(err.message || "Unable to load inventory");
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  const loadDeliveries = useCallback(async () => {
    setDeliveriesLoading(true);
    setDeliveriesError("");
    try {
      const query = new URLSearchParams({ status: "all", limit: "20" });
      const response = await fetch(`/api/parts/deliveries?${query}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load deliveries");
      }

      setDeliveries(data.deliveries || []);
    } catch (err) {
      setDeliveriesError(err.message || "Unable to load deliveries");
    } finally {
      setDeliveriesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    loadInventory();
    loadDeliveries();
  }, [loadSummary, loadInventory, loadDeliveries]);

  const highValueParts = useMemo(() => {
    if (!inventory || inventory.length === 0) return [];
    return [...inventory]
      .sort(
        (a, b) =>
          (b.qty_in_stock * (b.unit_cost || 0)) -
          (a.qty_in_stock * (a.unit_cost || 0))
      )
      .slice(0, 5);
  }, [inventory]);

  const lowStockParts = useMemo(() => {
    if (!inventory || inventory.length === 0) return [];
    const low = inventory
      .filter(
        (part) =>
          part.reorder_level > 0 && part.qty_in_stock <= part.reorder_level
      )
      .sort(
        (a, b) =>
          (a.qty_in_stock - a.reorder_level) -
          (b.qty_in_stock - b.reorder_level)
      )
      .slice(0, 5);

    if (low.length > 0) return low;

    return [...inventory]
      .sort((a, b) => a.qty_in_stock - b.qty_in_stock)
      .slice(0, 5);
  }, [inventory]);

  const outstandingDeliveries = useMemo(
    () =>
      deliveries.filter(
        (delivery) =>
          delivery.status !== "received" && delivery.status !== "cancelled"
      ),
    [deliveries]
  );

  return (
    <Layout>
      <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
        <h1 style={{ color: "#ff4040", fontSize: "2rem", marginBottom: "24px" }}>
          Parts Manager Dashboard
        </h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {summaryLoading ? (
            <div style={{ gridColumn: "1 / -1", color: "#888" }}>
              Loading summary...
            </div>
          ) : summaryError ? (
            <div
              style={{
                gridColumn: "1 / -1",
                color: "#b80d0d",
                fontWeight: 600,
              }}
            >
              {summaryError}
            </div>
          ) : summary ? (
            <>
              <div style={cardStyle}>
                <div style={{ color: "#a41d1d", fontSize: "0.85rem" }}>
                  Stock on Hand
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#ff4040" }}>
                  {summary.total_parts_in_stock?.toLocaleString() || "0"}
                </div>
                <div style={{ color: "#777" }}>
                  Value {formatCurrency(summary.stock_value)}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ color: "#a41d1d", fontSize: "0.85rem" }}>
                  Reserved for Jobs
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#ff4040" }}>
                  {formatCurrency(summary.reserved_value)}
                </div>
                <div style={{ color: "#777" }}>
                  Reserved stock value across open jobs
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ color: "#a41d1d", fontSize: "0.85rem" }}>
                  Spend YTD
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#ff4040" }}>
                  {formatCurrency(summary.total_spending)}
                </div>
                <div style={{ color: "#777" }}>
                  Based on recorded deliveries
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ color: "#a41d1d", fontSize: "0.85rem" }}>
                  Income YTD
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#ff4040" }}>
                  {formatCurrency(summary.total_income)}
                </div>
                <div style={{ color: "#777" }}>
                  From fitted parts on job cards
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "20px",
            marginBottom: "24px",
          }}
        >
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Highest Stock Value Parts</h2>
            {inventoryLoading ? (
              <div style={{ color: "#888" }}>Loading inventory...</div>
            ) : inventoryError ? (
              <div style={{ color: "#b80d0d", fontWeight: 600 }}>{inventoryError}</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#fff4f4", color: "#a41d1d" }}>
                    <th style={{ textAlign: "left", padding: "8px" }}>Part</th>
                    <th style={{ textAlign: "left", padding: "8px" }}>Stock</th>
                    <th style={{ textAlign: "left", padding: "8px" }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {highValueParts.map((part) => (
                    <tr key={part.id} style={{ borderBottom: "1px solid #ffe1e1" }}>
                      <td style={{ padding: "8px" }}>
                        <div style={{ fontWeight: 600 }}>
                          {part.part_number} · {part.name}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#777" }}>
                          {part.category || "Uncategorised"}
                        </div>
                      </td>
                      <td style={{ padding: "8px" }}>{part.qty_in_stock}</td>
                      <td style={{ padding: "8px" }}>
                        {formatCurrency(part.qty_in_stock * (part.unit_cost || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Low / Critical Stock</h2>
            {inventoryLoading ? (
              <div style={{ color: "#888" }}>Loading inventory...</div>
            ) : inventoryError ? (
              <div style={{ color: "#b80d0d", fontWeight: 600 }}>{inventoryError}</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#fff4f4", color: "#a41d1d" }}>
                    <th style={{ textAlign: "left", padding: "8px" }}>Part</th>
                    <th style={{ textAlign: "left", padding: "8px" }}>On Hand</th>
                    <th style={{ textAlign: "left", padding: "8px" }}>Reorder</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockParts.map((part) => (
                    <tr key={part.id} style={{ borderBottom: "1px solid #ffe1e1" }}>
                      <td style={{ padding: "8px" }}>
                        <div style={{ fontWeight: 600 }}>
                          {part.part_number} · {part.name}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#777" }}>
                          {part.service_default_zone || part.storage_location || "No bin"}
                        </div>
                      </td>
                      <td style={{ padding: "8px" }}>{part.qty_in_stock}</td>
                      <td style={{ padding: "8px" }}>
                        {part.reorder_level || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Outstanding Deliveries</h2>
          {deliveriesLoading ? (
            <div style={{ color: "#888" }}>Loading deliveries...</div>
          ) : deliveriesError ? (
            <div style={{ color: "#b80d0d", fontWeight: 600 }}>{deliveriesError}</div>
          ) : outstandingDeliveries.length === 0 ? (
            <div style={{ color: "#888" }}>
              No outstanding deliveries. Great work!
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fff4f4", color: "#a41d1d" }}>
                  <th style={{ textAlign: "left", padding: "8px" }}>Delivery</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Expected</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Outstanding Items</th>
                </tr>
              </thead>
              <tbody>
                {outstandingDeliveries.map((delivery) => (
                  <tr key={delivery.id} style={{ borderBottom: "1px solid #ffe1e1" }}>
                    <td style={{ padding: "8px" }}>
                      <div style={{ fontWeight: 600 }}>
                        {delivery.supplier || "Unknown supplier"}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#777" }}>
                        Ref: {delivery.order_reference || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "8px" }}>
                      {delivery.expected_date || "Awaiting ETA"}
                    </td>
                    <td style={{ padding: "8px" }}>
                      {(delivery.delivery_items || []).map((item) => {
                        const outstanding =
                          (item.quantity_ordered || 0) - (item.quantity_received || 0);
                        if (outstanding <= 0) return null;
                        return (
                          <div key={item.id}>
                            {item.part?.part_number} &times; {outstanding}
                          </div>
                        );
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default PartsManagerDashboard;
