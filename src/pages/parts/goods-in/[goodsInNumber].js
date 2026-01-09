import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { ScrollArea } from "@/components/scrollAPI";

const GOODS_IN_ROLES = new Set([
  "parts",
  "parts manager",
  "service",
  "service manager",
  "workshop manager",
  "after sales manager",
  "aftersales manager",
]);

const sectionCardStyle = {
  background: "var(--layer-section-level-1)",
  borderRadius: "20px",
  border: "1px solid var(--surface-light)",
  padding: "24px",
  boxShadow: "none",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
};

const labelStyle = {
  fontWeight: 600,
  fontSize: "0.85rem",
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const invoiceTableStyles = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: "0 10px",
  tableLayout: "fixed",
};

const invoiceHeaderCellStyle = {
  padding: "12px 16px",
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  background: "var(--layer-section-level-2)",
};

const invoiceCellStyle = {
  padding: "16px",
  fontSize: "0.95rem",
  color: "var(--text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const invoiceRowStyle = {
  background: "var(--layer-section-level-1)",
  borderRadius: "16px",
  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
};

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function GoodsInDetailPage() {
  const router = useRouter();
  const { user } = useUser();
  const [goodsIn, setGoodsIn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const goodsInNumber = router.query?.goodsInNumber;
  const userRoles = useMemo(
    () => (user?.roles || []).map((role) => role.toLowerCase()),
    [user?.roles]
  );
  const hasGoodsInAccess = userRoles.some((role) => GOODS_IN_ROLES.has(role));

  useEffect(() => {
    if (!router.isReady || !goodsInNumber) return;
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({ includeItems: "true" });
        if (isUuid(goodsInNumber)) {
          params.set("goodsInId", goodsInNumber);
        } else {
          params.set("goodsInNumber", goodsInNumber);
        }
        const response = await fetch(`/api/parts/goods-in?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Unable to load goods-in record");
        }
        if (isMounted) {
          setGoodsIn(payload.goodsIn);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [goodsInNumber, router.isReady]);

  if (!hasGoodsInAccess) {
    return (
      <Layout>
        <div style={{ padding: "32px" }}>
          <h1 style={{ marginBottom: "12px" }}>Goods In</h1>
          <p>You do not have permission to access this workspace.</p>
        </div>
      </Layout>
    );
  }

  const items = goodsIn?.items || [];
  const totals = items.reduce(
    (acc, item) => {
      const cost = Number(item.cost_price || 0) * Number(item.quantity || 0);
      const retail = Number(item.retail_price || 0) * Number(item.quantity || 0);
      acc.cost += cost;
      acc.retail += retail;
      return acc;
    },
    { cost: 0, retail: 0 }
  );
  const jobItems = items.filter((item) => item.added_to_job);
  const stockItems = items.filter((item) => !item.added_to_job);

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "18px", padding: "12px" }}>
        <section style={sectionCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <div>
              <div style={labelStyle}>Goods In</div>
              <h2 style={{ margin: "6px 0 0" }}>{goodsIn?.goods_in_number || goodsInNumber}</h2>
            </div>
            <div style={{ textAlign: "right", color: "var(--text-secondary)" }}>
              <div>{goodsIn?.status ? `Status: ${goodsIn.status}` : "Status: --"}</div>
              <div>{goodsIn?.invoice_date ? `Invoice date: ${goodsIn.invoice_date}` : ""}</div>
            </div>
          </div>
          {loading && <div>Loading goods-in record...</div>}
          {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
          {!loading && !error && goodsIn && (
            <div style={fieldGridStyle}>
              <div>
                <div style={labelStyle}>Supplier</div>
                <div>{goodsIn.supplier_name || "--"}</div>
                <div style={{ color: "var(--text-secondary)" }}>{goodsIn.supplier_address || ""}</div>
                <div style={{ color: "var(--text-secondary)" }}>{goodsIn.supplier_contact || ""}</div>
              </div>
              <div>
                <div style={labelStyle}>Invoice</div>
                <div>{goodsIn.invoice_number || "--"}</div>
                <div style={{ color: "var(--text-secondary)" }}>
                  Delivery note: {goodsIn.delivery_note_number || "--"}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Price Level</div>
                <div>{goodsIn.price_level || "--"}</div>
                <div style={{ color: "var(--text-secondary)" }}>Supplier account: {goodsIn.supplier_account_id || "--"}</div>
              </div>
            </div>
          )}
        </section>

        <section style={sectionCardStyle}>
          <h3 style={{ margin: 0 }}>Invoice lines</h3>
          {items.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
              No invoice lines found.
            </div>
          ) : (
            <ScrollArea
              maxHeight="420px"
              style={{
                borderRadius: "20px",
                border: "1px solid var(--surface-light)",
                overflowX: "hidden",
                background: "var(--layer-section-level-2)",
              }}
            >
              <table style={invoiceTableStyles}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={invoiceHeaderCellStyle}>Line</th>
                    <th style={invoiceHeaderCellStyle}>Part number</th>
                    <th style={invoiceHeaderCellStyle}>Description</th>
                    <th style={invoiceHeaderCellStyle}>Qty</th>
                    <th style={invoiceHeaderCellStyle}>Cost</th>
                    <th style={invoiceHeaderCellStyle}>Retail</th>
                    <th style={invoiceHeaderCellStyle}>Job</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} style={invoiceRowStyle}>
                      <td style={invoiceCellStyle}>{item.line_number || "--"}</td>
                      <td style={{ ...invoiceCellStyle, fontWeight: 600 }}>{item.part_number}</td>
                      <td style={{ ...invoiceCellStyle, color: "var(--text-secondary)" }}>{item.description}</td>
                      <td style={invoiceCellStyle}>{item.quantity}</td>
                      <td style={invoiceCellStyle}>
                        {item.cost_price ? currencyFormatter.format(item.cost_price) : "--"}
                      </td>
                      <td style={invoiceCellStyle}>
                        {item.retail_price ? currencyFormatter.format(item.retail_price) : "--"}
                      </td>
                      <td style={invoiceCellStyle}>{item.job_number || "Stock"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </section>

        <section style={sectionCardStyle}>
          <h3 style={{ margin: 0 }}>Totals</h3>
          <div style={fieldGridStyle}>
            <div>
              <div style={labelStyle}>Total Cost</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>{currencyFormatter.format(totals.cost)}</div>
            </div>
            <div>
              <div style={labelStyle}>Total Retail</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>{currencyFormatter.format(totals.retail)}</div>
            </div>
          </div>
        </section>

        <section style={sectionCardStyle}>
          <h3 style={{ margin: 0 }}>History</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <div style={labelStyle}>Added to job</div>
              {jobItems.length === 0 ? (
                <div style={{ marginTop: "8px", color: "var(--text-secondary)" }}>No parts allocated to jobs.</div>
              ) : (
                <div style={{ marginTop: "8px" }}>
                  {jobItems.map((item) => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                      <div>
                        <strong>{item.part_number}</strong> · {item.description}
                      </div>
                      <div style={{ color: "var(--text-secondary)" }}>
                        Line {item.line_number || "--"} · Qty {item.quantity} · Job {item.job_number || "--"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div style={labelStyle}>Added to stock</div>
              {stockItems.length === 0 ? (
                <div style={{ marginTop: "8px", color: "var(--text-secondary)" }}>No parts added to stock.</div>
              ) : (
                <div style={{ marginTop: "8px" }}>
                  {stockItems.map((item) => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                      <div>
                        <strong>{item.part_number}</strong> · {item.description}
                      </div>
                      <div style={{ color: "var(--text-secondary)" }}>
                        Line {item.line_number || "--"} · Qty {item.quantity}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export default GoodsInDetailPage;
