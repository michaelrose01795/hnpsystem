// file location: src/singlescroll/hooks/useShopProducts.js
//
// Loads the public shop catalog from /api/shop/products + categories.
// Empty arrays are returned during loading or if the API is unreachable -
// the shop section then renders an "Empty store" state and the page itself
// stays up.

import { useEffect, useState } from "react";

export default function useShopProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch("/api/shop/products"),
          fetch("/api/shop/categories"),
        ]);
        const prodJson = prodRes.ok ? await prodRes.json() : null;
        const catJson = catRes.ok ? await catRes.json() : null;
        if (cancelled) return;
        setProducts(prodJson?.data || []);
        setCategories(catJson?.data || []);
      } catch {
        /* silent - shop simply shows empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { products, categories, loading };
}
