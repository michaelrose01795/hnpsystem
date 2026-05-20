// file location: src/features/websiteManager/shopApi.js
// Client wrapper for /api/shop/admin/* endpoints.

const json = async (res, label) => {
  let payload = null;
  try {
    payload = await res.json();
  } catch (_) {
    /* parse failure - treated below */
  }
  if (!res.ok || payload?.success === false) {
    const message = payload?.message || `${label} failed (${res.status})`;
    // eslint-disable-next-line no-console
    console.error(`[shopApi] ${label}:`, message);
    throw new Error(message);
  }
  return payload?.data ?? null;
};

export const fetchProducts = () =>
  fetch("/api/shop/admin/products", { credentials: "same-origin" }).then((r) =>
    json(r, "GET /admin/products")
  );

export const createProduct = (row) =>
  fetch("/api/shop/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(row),
  }).then((r) => json(r, "POST /admin/products"));

export const patchProduct = (id, row) =>
  fetch(`/api/shop/admin/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(row),
  }).then((r) => json(r, `PATCH /admin/products/${id}`));

export const deleteProduct = (id) =>
  fetch(`/api/shop/admin/products/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  }).then((r) => json(r, `DELETE /admin/products/${id}`));

export const fetchCategories = () =>
  fetch("/api/shop/admin/categories", { credentials: "same-origin" }).then((r) =>
    json(r, "GET /admin/categories")
  );

export const createCategory = (row) =>
  fetch("/api/shop/admin/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(row),
  }).then((r) => json(r, "POST /admin/categories"));

export const patchCategory = (id, row) =>
  fetch(`/api/shop/admin/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(row),
  }).then((r) => json(r, `PATCH /admin/categories/${id}`));

export const deleteCategory = (id) =>
  fetch(`/api/shop/admin/categories/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  }).then((r) => json(r, `DELETE /admin/categories/${id}`));

export const fetchOrders = () =>
  fetch("/api/shop/admin/orders", { credentials: "same-origin" }).then((r) =>
    json(r, "GET /admin/orders")
  );

export const fetchOrder = (id) =>
  fetch(`/api/shop/admin/orders/${id}`, { credentials: "same-origin" }).then((r) =>
    json(r, `GET /admin/orders/${id}`)
  );

export const patchOrderStatus = (id, status) =>
  fetch(`/api/shop/admin/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ status }),
  }).then((r) => json(r, `PATCH /admin/orders/${id}`));
