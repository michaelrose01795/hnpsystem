// file location: src/singlescroll/hooks/useShopCart.js
//
// Client-side cart state for the public /website shop. Persists in
// localStorage under "hnp_shop_cart_v1" so a refresh keeps the cart and so
// the /website/shop/cart and /website/shop/checkout pages can read it.
//
// Each item: { id, name, price_pence, image_url, qty }. The hook exposes
// add / remove / updateQty / clear and derived totals.

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "hnp_shop_cart_v1";
const EVENT_NAME = "hnp:shop-cart-changed";

const readCart = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCart = (items) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    /* quota / private-mode - ignore */
  }
};

export default function useShopCart() {
  const [items, setItems] = useState([]);

  // Hydrate on mount + listen for cross-component changes.
  useEffect(() => {
    setItems(readCart());
    const reload = () => setItems(readCart());
    window.addEventListener(EVENT_NAME, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(EVENT_NAME, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const update = useCallback((next) => {
    setItems(next);
    writeCart(next);
  }, []);

  const add = useCallback(
    (product, qty = 1) => {
      const existing = items.find((i) => i.id === product.id);
      const safeQty = Math.max(1, parseInt(qty, 10) || 1);
      const next = existing
        ? items.map((i) =>
            i.id === product.id ? { ...i, qty: i.qty + safeQty } : i
          )
        : [
            ...items,
            {
              id: product.id,
              name: product.name,
              price_pence: product.price_pence,
              image_url: product.image_url,
              sku: product.sku,
              qty: safeQty,
            },
          ];
      update(next);
    },
    [items, update]
  );

  const updateQty = useCallback(
    (productId, qty) => {
      const safeQty = Math.max(0, parseInt(qty, 10) || 0);
      if (safeQty === 0) {
        update(items.filter((i) => i.id !== productId));
        return;
      }
      update(items.map((i) => (i.id === productId ? { ...i, qty: safeQty } : i)));
    },
    [items, update]
  );

  const remove = useCallback(
    (productId) => update(items.filter((i) => i.id !== productId)),
    [items, update]
  );

  const clear = useCallback(() => update([]), [update]);

  const totals = useMemo(() => {
    const subtotal_pence = items.reduce(
      (sum, i) => sum + (i.price_pence || 0) * i.qty,
      0
    );
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    return {
      subtotal_pence,
      count,
      subtotal: formatGbp(subtotal_pence),
    };
  }, [items]);

  return { items, add, remove, updateQty, clear, totals };
}

export function formatGbp(pence) {
  const value = (pence || 0) / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}
