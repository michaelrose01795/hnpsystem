// file location: src/features/websiteManager/panels/ShopPanel.js
//
// Staff Shop management. Three sub-tabs:
//   Products    -- CRUD on shop_products via /api/shop/admin/products
//   Categories  -- CRUD on shop_categories
//   Orders      -- read + status updates on shop_orders
//
// Reuses ../editors/SectionEditor for the typed forms so the shop forms look
// and behave like every other editor in the manager.

import React, { useCallback, useEffect, useState } from "react";
import Section from "@/components/Section";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import EmptyState from "@/components/ui/EmptyState";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
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
import { StatusBadge, formatDateTime } from "../helpers";

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
      <Section title="Shop">
        <TabGroup items={TABS} value={tab} onChange={setTab} ariaLabel="Shop sub-sections" />
      </Section>

      {tab === "products" && <ProductsTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "orders" && <OrdersTab />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Shared list plumbing for the two CRUD tabs                          */
/* ------------------------------------------------------------------ */

function useShopList(fetcher) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetcher());
      setError("");
    } catch (e) {
      setRows([]);
      setError(e?.message || "This list could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, loading, error, setError, reload };
}

function PanelError({ message }) {
  if (!message) return null;
  return (
    <div className="website-manager__notice website-manager__notice--warning" role="alert">
      {message}
    </div>
  );
}

/* ------------------------------- products ----------------------------- */

function ProductsTab() {
  const { rows, loading, error, setError, reload } = useShopList(fetchProducts);
  const [editing, setEditing] = useState({ mode: null, row: null });
  const close = () => setEditing({ mode: null, row: null });

  const handleSave = async (draft) => {
    if (editing.mode === "add") await createProduct(draft);
    else await patchProduct(editing.row.id, draft);
    close();
    reload();
  };

  const handleDelete = async () => {
    if (!editing.row) return;
    if (!window.confirm(`Delete "${editing.row.name}"? This cannot be undone.`)) return;
    try {
      await deleteProduct(editing.row.id);
      close();
      reload();
    } catch (e) {
      setError(e?.message || "That product could not be deleted.");
    }
  };

  return (
    <Section title="Products">
      <div className="website-manager__actions">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setEditing({ mode: "add", row: { status: "draft", stock_qty: 0 } })}
        >
          + Add product
        </Button>
      </div>

      <PanelError message={error} />

      {editing.mode && (
        <SectionEditor
          schema={PRODUCT_SCHEMA}
          initialValue={editing.row || {}}
          onSave={handleSave}
          onCancel={close}
          onDelete={editing.mode === "edit" ? handleDelete : null}
          saveLabel={editing.mode === "add" ? "Add product" : "Save changes"}
        />
      )}

      {loading && <p className="website-manager__meta">Loading…</p>}

      {!loading && rows.length === 0 && (
        <EmptyState
          variant="bare"
          title="No products yet"
          description="Add your first catalogue item and it appears in the Shop section of the public website."
        />
      )}

      {!loading && rows.length > 0 && (
        <div className="website-manager__table-scroll">
          <table className="app-data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="website-manager__cell-strong">{p.name}</td>
                  <td className="website-manager__cell-mono">{p.sku || "—"}</td>
                  <td>{formatGbp(p.price_pence)}</td>
                  <td>{p.stock_qty}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>
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
  const { rows, loading, error, setError, reload } = useShopList(fetchCategories);
  const [editing, setEditing] = useState({ mode: null, row: null });
  const close = () => setEditing({ mode: null, row: null });

  const handleSave = async (draft) => {
    if (editing.mode === "add") await createCategory(draft);
    else await patchCategory(editing.row.id, draft);
    close();
    reload();
  };

  const handleDelete = async () => {
    if (!editing.row) return;
    if (!window.confirm(`Delete category "${editing.row.name}"? This cannot be undone.`)) return;
    try {
      await deleteCategory(editing.row.id);
      close();
      reload();
    } catch (e) {
      setError(e?.message || "That category could not be deleted.");
    }
  };

  return (
    <Section title="Categories">
      <div className="website-manager__actions">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setEditing({ mode: "add", row: { status: "active" } })}
        >
          + Add category
        </Button>
      </div>

      <PanelError message={error} />

      {editing.mode && (
        <SectionEditor
          schema={CATEGORY_SCHEMA}
          initialValue={editing.row || {}}
          onSave={handleSave}
          onCancel={close}
          onDelete={editing.mode === "edit" ? handleDelete : null}
          saveLabel={editing.mode === "add" ? "Add category" : "Save changes"}
        />
      )}

      {loading && <p className="website-manager__meta">Loading…</p>}

      {!loading && rows.length === 0 && (
        <EmptyState
          variant="bare"
          title="No categories yet"
          description="Categories group products in the shop. Add one to start organising the catalogue."
        />
      )}

      {!loading && rows.length > 0 && (
        <div className="website-manager__table-scroll">
          <table className="app-data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="website-manager__cell-strong">{c.name}</td>
                  <td className="website-manager__cell-mono">{c.slug}</td>
                  <td className="website-manager__cell-muted">{c.status}</td>
                  <td>
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
  const { rows: orders, loading, error, setError, reload } = useShopList(fetchOrders);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      return;
    }
    fetchOrder(openId)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [openId]);

  const handleStatusChange = async (orderId, status) => {
    try {
      await patchOrderStatus(orderId, status);
      reload();
      if (openId === orderId) fetchOrder(orderId).then(setDetail);
    } catch (e) {
      setError(e?.message || "That order status could not be saved.");
    }
  };

  return (
    <Section title="Orders">
      <PanelError message={error} />

      {loading && <p className="website-manager__meta">Loading…</p>}

      {!loading && orders.length === 0 && (
        <EmptyState
          variant="bare"
          title="No orders yet"
          description="Customer orders placed through the shop appear here, where you can move them through fulfilment."
        />
      )}

      {!loading && orders.length > 0 && (
        <div className="website-manager__table-scroll">
          <table className="app-data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Date</th>
                <th>Email</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="website-manager__cell-strong">{o.order_number}</td>
                  <td className="website-manager__cell-muted website-manager__cell-nowrap">
                    {formatDateTime(o.created_at)}
                  </td>
                  <td className="website-manager__cell-muted">{o.contact_email}</td>
                  <td>{formatGbp(o.total_pence)}</td>
                  <td>
                    <DropdownField
                      value={o.status}
                      onChange={(e) => handleStatusChange(o.id, e.target.value)}
                      options={ORDER_STATUSES}
                      size="sm"
                      aria-label={`Status for order ${o.order_number}`}
                    />
                  </td>
                  <td>
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
        <LayerTheme gap="var(--space-2)">
          <span className="website-manager__editor-title">{detail.order_number}</span>
          <div className="website-manager__table-scroll">
            <table className="app-data-table app-data-table--compact">
              <tbody>
                {(detail.items || []).map((it) => (
                  <tr key={it.id}>
                    <td>
                      {it.name} × {it.qty}
                    </td>
                    <td>{formatGbp(it.line_total_pence)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="website-manager__cell-strong">Total</td>
                  <td className="website-manager__cell-strong">
                    {formatGbp(detail.total_pence)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {detail.shipping_address ? (
            <span className="website-manager__meta">
              {`Ship to: ${[
                detail.shipping_address.name,
                detail.shipping_address.line1,
                detail.shipping_address.line2,
                detail.shipping_address.city,
                detail.shipping_address.postcode,
              ]
                .filter(Boolean)
                .join(", ")}`}
            </span>
          ) : null}
        </LayerTheme>
      )}
    </Section>
  );
}
