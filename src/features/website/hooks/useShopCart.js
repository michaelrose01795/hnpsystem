// file location: src/features/website/hooks/useShopCart.js
//
// The basket for the public /website shop.
//
// Local-first, then synced. The basket always lives in localStorage under
// "hnp_shop_cart_v1", so it survives a refresh and works for a signed-out
// visitor with no account at all. When a customer IS signed in, the same
// basket is mirrored to public.shop_carts through /api/shop/cart, so a
// basket started on a phone is still there on a laptop.
//
// Sign-in merge: the first time a signed-in session is seen, the local
// basket is PUT with merge:true. The server unions it with whatever was
// saved (taking the larger quantity per line, never the sum) and returns
// the authoritative, re-priced result, which then replaces local state.
//
// Every item: { id, name, sku, price_pence, image_url, qty }. The hook
// exposes add / remove / updateQty / clear, derived totals, and the
// sign-in state the UI uses to prompt for a login.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useCustomerSession from "./useCustomerSession";

const STORAGE_KEY = "hnp_shop_cart_v1";
const EVENT_NAME = "hnp:shop-cart-changed";
const SYNC_DEBOUNCE_MS = 600;
const MAX_QTY = 99;

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

const toLines = (items) =>
  items.map((i) => ({ id: i.id, qty: i.qty }));

export default function useShopCart() {
  const [items, setItems] = useState([]);
  const { customer, signedIn, loading: sessionLoading } = useCustomerSession();
  const [syncState, setSyncState] = useState("idle"); // idle | syncing | saved | local
  const mergedFor = useRef(null);
  const syncTimer = useRef(null);
  // Suppresses the outbound sync that would otherwise fire in response to
  // state the server itself just handed us.
  const skipNextSync = useRef(false);
  // Set by clear(): the first sync after it must REPLACE the saved basket,
  // not merge into it. Without this, clearing on the checkout-success page
  // (which runs before the session has resolved) would be undone a moment
  // later when the sign-in merge unioned the empty local basket back into
  // the saved one.
  const pendingReplace = useRef(false);

  // Hydrate on mount + listen for cross-component changes (two mounted
  // copies of this hook — say the drawer and a product page — stay level).
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

  // On sign-in: merge the local basket into the saved one, once.
  useEffect(() => {
    if (sessionLoading || !signedIn) return;
    const key = customer?.id || "signed-in";
    if (mergedFor.current === key) return;
    mergedFor.current = key;

    let cancelled = false;
    setSyncState("syncing");
    (async () => {
      try {
        const res = await fetch("/api/shop/cart", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: toLines(readCart()),
            merge: !pendingReplace.current,
          }),
        });
        pendingReplace.current = false;
        const json = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (json?.success && Array.isArray(json.items)) {
          skipNextSync.current = true;
          setItems(json.items);
          writeCart(json.items);
          setSyncState(json.persisted ? "saved" : "local");
        } else {
          setSyncState("local");
        }
      } catch {
        if (!cancelled) setSyncState("local");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionLoading, signedIn, customer?.id]);

  // Push later changes up, debounced so a run of +/- taps is one request.
  const scheduleSync = useCallback(
    (next) => {
      if (!signedIn) return;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      setSyncState("syncing");
      syncTimer.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/shop/cart", {
            method: "PUT",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: toLines(next) }),
          });
          const json = res.ok ? await res.json() : null;
          setSyncState(json?.persisted ? "saved" : "local");
        } catch {
          setSyncState("local");
        }
      }, SYNC_DEBOUNCE_MS);
    },
    [signedIn]
  );

  useEffect(
    () => () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    },
    []
  );

  const update = useCallback(
    (next) => {
      setItems(next);
      writeCart(next);
      if (skipNextSync.current) {
        skipNextSync.current = false;
        return;
      }
      scheduleSync(next);
    },
    [scheduleSync]
  );

  const add = useCallback(
    (product, qty = 1) => {
      const safeQty = Math.max(1, parseInt(qty, 10) || 1);
      const existing = items.find((i) => i.id === product.id);
      const next = existing
        ? items.map((i) =>
            i.id === product.id
              ? { ...i, qty: Math.min(MAX_QTY, i.qty + safeQty) }
              : i
          )
        : [
            ...items,
            {
              id: product.id,
              name: product.name,
              price_pence: product.price_pence,
              image_url: product.image_url || null,
              sku: product.sku || null,
              qty: Math.min(MAX_QTY, safeQty),
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
      update(
        items.map((i) =>
          i.id === productId ? { ...i, qty: Math.min(MAX_QTY, safeQty) } : i
        )
      );
    },
    [items, update]
  );

  const remove = useCallback(
    (productId) => update(items.filter((i) => i.id !== productId)),
    [items, update]
  );

  const clear = useCallback(() => {
    pendingReplace.current = true;
    update([]);
  }, [update]);

  const qtyFor = useCallback(
    (productId) => items.find((i) => i.id === productId)?.qty || 0,
    [items]
  );

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

  return {
    items,
    add,
    remove,
    updateQty,
    clear,
    qtyFor,
    totals,
    // Sign-in state, so the basket UI can prompt a login and say where the
    // basket is being kept.
    signedIn,
    sessionLoading,
    customer,
    syncState,
    savedToAccount: syncState === "saved",
  };
}

export function formatGbp(pence) {
  const value = (pence || 0) / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}
