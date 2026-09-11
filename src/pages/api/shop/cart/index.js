// file location: src/pages/api/shop/cart/index.js
//
// The signed-in customer's saved basket.
//
//   GET  /api/shop/cart            -> { authenticated, items, persisted }
//   PUT  /api/shop/cart  { items } -> replace the saved basket
//   PUT  /api/shop/cart  { items, merge: true }
//                                  -> merge the caller's local basket into
//                                     the saved one and return the result
//                                     (used once, straight after sign-in)
//
// Signed-out callers get 200 + authenticated:false rather than a 401: the
// shop must keep working for them out of localStorage, and a 401 in the
// browser console on every anonymous page view is noise, not a signal.
//
// Line prices are never trusted from the client — every item is re-priced
// from public.parts_catalog before it is saved, and items that are no
// longer sellable are dropped.

import { getCustomerSessionFromReq } from "@/lib/auth/customerSession";
import { getCustomerCart, saveCustomerCart } from "@/lib/database/shop";
import { getPublicPartsByIds } from "@/lib/database/partsCatalogPublic";

const MAX_LINES = 60;
const MAX_QTY = 99;

const sanitiseIncoming = (items) =>
  (Array.isArray(items) ? items : [])
    .filter((it) => it && typeof it.id === "string")
    .slice(0, MAX_LINES)
    .map((it) => ({
      id: it.id,
      qty: Math.min(MAX_QTY, Math.max(1, parseInt(it.qty, 10) || 1)),
    }));

/**
 * Re-price a list of { id, qty } against the live catalogue. Unknown or
 * withdrawn ids fall out; a saved basket therefore self-heals rather than
 * carrying a line that can never be bought.
 */
const repriceLines = async (lines) => {
  if (lines.length === 0) return [];
  const products = await getPublicPartsByIds(lines.map((l) => l.id));
  const byId = new Map(products.map((p) => [p.id, p]));
  return lines.flatMap((line) => {
    const product = byId.get(line.id);
    if (!product) return [];
    return [
      {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price_pence: product.price_pence,
        image_url: product.image_url,
        qty: line.qty,
      },
    ];
  });
};

const mergeLines = (saved, incoming) => {
  const byId = new Map();
  [...saved, ...incoming].forEach((line) => {
    const existing = byId.get(line.id);
    // Merge takes the larger quantity rather than the sum: a basket synced
    // twice from the same device must not silently double up.
    if (existing) existing.qty = Math.min(MAX_QTY, Math.max(existing.qty, line.qty));
    else byId.set(line.id, { ...line });
  });
  return [...byId.values()];
};

export default async function handler(req, res) {
  const session = getCustomerSessionFromReq(req);

  if (!session) {
    if (req.method !== "GET" && req.method !== "PUT") {
      res.setHeader("Allow", "GET, PUT");
      return res
        .status(405)
        .json({ success: false, message: "Method Not Allowed" });
    }
    // Anonymous: nothing to load, nothing to save. The client keeps its
    // basket in localStorage and shows the "sign in to save" prompt.
    return res
      .status(200)
      .json({ success: true, authenticated: false, items: [], persisted: false });
  }

  const customerId = session.customerId;

  if (req.method === "GET") {
    const saved = await getCustomerCart(customerId);
    const items = await repriceLines(sanitiseIncoming(saved.items));
    return res.status(200).json({
      success: true,
      authenticated: true,
      items,
      persisted: saved.persisted,
    });
  }

  if (req.method === "PUT") {
    const incoming = sanitiseIncoming(req.body?.items);
    let lines = incoming;

    if (req.body?.merge) {
      const saved = await getCustomerCart(customerId);
      lines = mergeLines(sanitiseIncoming(saved.items), incoming);
    }

    const items = await repriceLines(lines);
    const result = await saveCustomerCart(customerId, items);
    return res.status(result.ok ? 200 : 500).json({
      success: result.ok,
      authenticated: true,
      items,
      persisted: result.persisted,
      ...(result.ok ? {} : { message: "Could not save your basket." }),
    });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ success: false, message: "Method Not Allowed" });
}
