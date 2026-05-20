// file location: src/features/websiteManager/panels/ShopPanel.js
//
// Staff Shop management. Three sub-tabs:
//   Products    -- CRUD on shop_products via /api/shop/admin/products
//   Categories  -- CRUD on shop_categories
//   Orders      -- read + status updates on shop_orders
//
// Reuses ../editors/SectionEditor for the typed forms.

import React, { useCallback, useEffect, useState } from "react";
import Section from "@/components/Section";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import SectionEditor from "../editors/SectionEditor";
import {
  PRODUCT_SCHEMA,
  CATEGORY_SCHEMA,
  ORDER_STATUSES,
} from "../editors/shopSchemas";
import {
  fetchProducts,
  createProduct,
  patchProduct,
  deleteProduct,
  fetchCategories,
  createCategory,
  patchCategory,
  deleteCategory,
  fetchOrders,
  fetchOrder,
  patchOrderStatus,
} from "../shopApi";
import {
  cellStyle,
  headCellStyle,
  formatDateTime,
  EmptyState,
} from "../helpers";

const TABS = [
  { value: "products", label: "Products" },
  { value: "categories", label: "Categories" },
  { value: "orders", label: "Orders" },
];

const formatGbp = (pence) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    (pence || 0) / 100
  );

export default function ShopPanel() {
  const [tab, setTab] = useState("products");
  return (
    <>
      <Section
        title="Shop"
        subtitle="Manage the public /website#shop catalogue, categories, and orders."
      >
        <TabGroup
          items={TABS}
          value={tab}
          onChange={setTab}
          ariaLabel="Shop sub-sections"
        />
      </Section>

      {tab === "products" && <ProductsTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "orders" && <OrdersTab />}
    </>
  );
}

/* ------------------------------- products ----------------------------- */

function ProductsTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({ mode: null, row: null });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchProducts());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSave = async (draft) => {
    if (editing.mode === "add") await createProduct(draft);
    else await patchProduct(editing.row.id, draft);
    setEditing({ mode: null, row: null });
    reload();
  };
  const handleDelete = async () => {
    if (!editing.row) return;
    if (!window.confirm(`Delete "${editing.row.name}"?`)) return;
    await deleteProduct(editing.row.id);
    setEditing({ mode: null, row: null });
    reload();
  };

  return (
    <Section title="Products">
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() =>
          setEditing({ mode: "add", row: { status: "draft", stock_qty: 0 } })
        }
      >
        + Add product
      </Button>

      {editing.mode && (
        <SectionEditor
          schema={PRODUCT_SCHEMA}
          initialValue={editing.row || {}}
          onSave={handleSave}
          onCancel={() => setEditing({ mode: null, row: null })}
          onDelete={editing.mode === "edit" ? handleDelete : null}
        />
      )}

      {loading && <div style={{ color: "var(--text-1)" }}>Loading…</div>}
      {!loading && rows.length === 0 && (
        <EmptyState message="No products yet. Click + Add product to get started." />
      )}
      {!loading && rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr>
                <th style={headCellStyle}>Name</th>
                <th style={headCellStyle}>SKU</th>
                <th style={headCellStyle}>Price</th>
                <th style={headCellStyle}>Stock</th>
                <th style={headCellStyle}>Status</th>
                <th style={headCellStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...cellStyle, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...cellStyle, color: "var(--text-1)" }}>{p.sku || "—"}</td>
                  <td style={cellStyle}>{formatGbp(p.price_pence)}</td>
                  <td style={cellStyle}>{p.stock_qty}</td>
                  <td style={cellStyle}>{p.status}</td>
                  <td style={cellStyle}>
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => setEditing({ mode: "edit", row: p })}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ------------------------------ categories ---------------------------- */

function CategoriesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({ mode: null, row: null });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchCategories());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const handleSave = async (draft) => {
    if (editing.mode === "add") await createCategory(draft);
    else await patchCategory(editing.row.id, draft);
    setEditing({ mode: null, row: null });
    reload();
  };
  const handleDelete = async () => {
    if (!editing.row) return;
    if (!window.confirm(`Delete category "${editing.row.name}"?`)) return;
    await deleteCategory(editing.row.id);
    setEditing({ mode: null, row: null });
    reload();
  };

  return (
    <Section title="Categories">
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => setEditing({ mode: "add", row: { status: "active" } })}
      >
        + Add category
      </Button>
      {editing.mode && (
        <SectionEditor
          schema={CATEGORY_SCHEMA}
          initialValue={editing.row || {}}
          onSave={handleSave}
          onCancel={() => setEditing({ mode: null, row: null })}
          onDelete={editing.mode === "edit" ? handleDelete : null}
        />
      )}
      {loading && <div style={{ color: "var(--text-1)" }}>Loading…</div>}
      {!loading && rows.length === 0 && <EmptyState message="No categories yet." />}
      {!loading && rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr>
                <th style={headCellStyle}>Name</th>
                <th style={headCellStyle}>Slug</th>
                <th style={headCellStyle}>Status</th>
                <th style={headCellStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td style={{ ...cellStyle, fontWeight: 600 }}>{c.name}</td>
                  <td style={{ ...cellStyle, color: "var(--text-1)" }}>{c.slug}</td>
                  <td style={cellStyle}>{c.status}</td>
                  <td style={cellStyle}>
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => setEditing({ mode: "edit", row: c })}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* -------------------------------- orders ------------------------------ */

function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await fetchOrders());
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      return;
    }
    fetchOrder(openId).then(setDetail).catch(() => setDetail(null));
  }, [openId]);

  const handleStatusChange = async (orderId, status) => {
    await patchOrderStatus(orderId, status);
    reload();
    if (openId === orderId) fetchOrder(orderId).then(setDetail);
  };

  return (
    <Section title="Orders">
      {loading && <div style={{ color: "var(--text-1)" }}>Loading…</div>}
      {!loading && orders.length === 0 && (
        <EmptyState message="No orders yet." />
      )}
      {!loading && orders.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr>
                <th style={headCellStyle}>Order #</th>
                <th style={headCellStyle}>Date</th>
                <th style={headCellStyle}>Email</th>
                <th style={headCellStyle}>Total</th>
                <th style={headCellStyle}>Status</th>
                <th style={headCellStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ ...cellStyle, fontWeight: 600 }}>{o.order_number}</td>
                  <td style={{ ...cellStyle, color: "var(--text-1)" }}>
                    {formatDateTime(o.created_at)}
                  </td>
                  <td style={{ ...cellStyle, color: "var(--text-1)" }}>{o.contact_email}</td>
                  <td style={cellStyle}>{formatGbp(o.total_pence)}</td>
                  <td style={cellStyle}>
                    <select
                      className="app-input"
                      value={o.status}
                      onChange={(e) => handleStatusChange(o.id, e.target.value)}
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={cellStyle}>
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => setOpenId(openId === o.id ? null : o.id)}
                    >
                      {openId === o.id ? "Close" : "View"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && (
        <LayerTheme padding="14px" gap="8px">
          <div style={{ fontWeight: 700, color: "var(--accentText)" }}>
            {detail.order_number} — items
          </div>
          {(detail.items || []).map((it) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>
                {it.name} × {it.qty}
              </span>
              <span>{formatGbp(it.line_total_pence)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total</span>
            <span>{formatGbp(detail.total_pence)}</span>
          </div>
          {detail.shipping_address ? (
            <div style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
              Ship to: {detail.shipping_address.name || ""},{" "}
              {[detail.shipping_address.line1, detail.shipping_address.line2, detail.shipping_address.city, detail.shipping_address.postcode]
                .filter(Boolean)
                .join(", ")}
            </div>
          ) : null}
        </LayerTheme>
      )}
    </Section>
  );
}
