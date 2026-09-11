// file location: src/features/website/shop/PartDetailPage.js
//
// /website/parts-catalog/[partId] — one part, in full.
//
// The row is fetched from /api/shop/parts-catalog/:partId, which reads
// public.parts_catalog (the staff DMS Stock Catalogue) through the public
// column allowlist — cost price, supplier, storage location and internal
// notes never reach this page.
//
// The customer can pick a quantity and add to basket here as well as from
// the catalogue grid. Parts with no free stock are still shown, because we
// can order almost anything in: they offer a phone enquiry rather than an
// add-to-basket.

import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import ShopShell from "./ShopShell";
import ProductCard, { ProductMedia, StockLine } from "./ProductCard";
import CartDrawer from "./CartDrawer";
import BasketAccountNotice from "./BasketAccountNotice";
import useShopCart, { formatGbp } from "../hooks/useShopCart";
import { siteContent } from "../data/siteContent";

const PARTS_PHONE = "01732 870711";

export default function PartDetailPage() {
  const router = useRouter();
  const { partId } = router.query;
  const cart = useShopCart();

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qty, setQty] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!partId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setQty(1);
    fetch(`/api/shop/parts-catalog/${partId}`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || "That part could not be found.");
        }
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        setProduct(json.data);
        setRelated(json.related || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partId]);

  const breadcrumb = (
    <>
      <Link href="/website#shop">Shop</Link>
      <span aria-hidden="true"> / </span>
      <Link href="/website/parts-catalog">Parts catalogue</Link>
      {product ? (
        <>
          <span aria-hidden="true"> / </span>
          <span className="ws-breadcrumb-current">{product.name}</span>
        </>
      ) : null}
    </>
  );

  const basketButton = (
    <button
      type="button"
      className="ws-shop-cartbutton"
      onClick={() => setDrawerOpen(true)}
    >
      Basket
      <span className="ws-shop-cartbutton-count">{cart.totals.count}</span>
    </button>
  );

  if (loading) {
    return (
      <ShopShell title="Loading part…" eyebrow="Parts & Accessories" breadcrumb={breadcrumb}>
        <p className="ws-muted">Fetching the latest price and availability…</p>
      </ShopShell>
    );
  }

  if (error || !product) {
    return (
      <ShopShell
        title="Part not found"
        eyebrow="Parts & Accessories"
        breadcrumb={breadcrumb}
      >
        <div className="ws-catalog-empty">
          <p>{error || "That part is no longer available."}</p>
          <p className="ws-muted">
            Call the parts team on{" "}
            <a href="tel:01732870711" className="ws-catalog-phone">
              {PARTS_PHONE}
            </a>{" "}
            — if we can get it, we will.
          </p>
          <Link href="/website/parts-catalog" className="ws-btn ws-btn--primary">
            Back to the catalogue
          </Link>
        </div>
      </ShopShell>
    );
  }

  const available = Number(product.stock_qty) || 0;
  const out = available <= 0;
  const maxQty = out ? 1 : Math.min(available, 20);
  const inBasket = cart.qtyFor(product.id);

  return (
    <>
      <Head>
        <title>{`${product.name} - ${siteContent.brand.name}`}</title>
        <meta
          name="description"
          content={
            product.description ||
            `${product.name} (${product.sku || "genuine part"}) from Humphries & Parks, West Malling.`
          }
        />
      </Head>
      <ShopShell
        eyebrow="Parts & Accessories"
        title={product.name}
        breadcrumb={breadcrumb}
        navActions={basketButton}
      >
        <div className="ws-pdp" data-presentation="website-part-detail">
          <div className="ws-pdp-media">
            <ProductMedia product={product} />
          </div>

          <div className="ws-pdp-info">
            <dl className="ws-pdp-specs">
              {product.sku ? (
                <div className="ws-pdp-spec">
                  <dt>Part number</dt>
                  <dd>{product.sku}</dd>
                </div>
              ) : null}
              {product.oem_reference ? (
                <div className="ws-pdp-spec">
                  <dt>OE reference</dt>
                  <dd>{product.oem_reference}</dd>
                </div>
              ) : null}
              {product.category_name ? (
                <div className="ws-pdp-spec">
                  <dt>Category</dt>
                  <dd>
                    <Link
                      href={`/website/parts-catalog?category=${encodeURIComponent(
                        product.category_id
                      )}`}
                    >
                      {product.category_name}
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>

            {product.description ? (
              <p className="ws-pdp-description">{product.description}</p>
            ) : (
              <p className="ws-muted">
                Genuine factory part. Not sure it is the right one for your
                vehicle? Call us with your registration and we will check it
                against the manufacturer catalogue.
              </p>
            )}

            <div className="ws-pdp-buy">
              <p className="ws-product-price ws-pdp-price">
                {formatGbp(product.price_pence)}
                <span className="ws-pdp-price-note">incl. VAT</span>
              </p>
              <StockLine product={product} />

              {out ? (
                <>
                  <p className="ws-muted">
                    Not on the shelf right now — most parts arrive next working
                    day.
                  </p>
                  <a
                    href="tel:01732870711"
                    className="ws-btn ws-btn--primary ws-pdp-cta"
                  >
                    Call to order — {PARTS_PHONE}
                  </a>
                </>
              ) : (
                <>
                  <div className="ws-pdp-qty">
                    <label htmlFor="ws-pdp-qty-input">Quantity</label>
                    <div className="ws-pdp-qty-controls">
                      <button
                        type="button"
                        className="ws-cart-qty"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        aria-label="Reduce quantity"
                      >
                        −
                      </button>
                      <input
                        id="ws-pdp-qty-input"
                        type="number"
                        min="1"
                        max={maxQty}
                        value={qty}
                        onChange={(e) =>
                          setQty(
                            Math.min(
                              maxQty,
                              Math.max(1, parseInt(e.target.value, 10) || 1)
                            )
                          )
                        }
                      />
                      <button
                        type="button"
                        className="ws-cart-qty"
                        onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ws-btn ws-btn--primary ws-pdp-cta"
                    onClick={() => {
                      cart.add(product, qty);
                      setDrawerOpen(true);
                    }}
                  >
                    Add {qty > 1 ? `${qty} ` : ""}to basket
                  </button>
                  {inBasket > 0 ? (
                    <p className="ws-muted ws-pdp-inbasket">
                      {inBasket} already in your basket.
                    </p>
                  ) : null}
                </>
              )}

              <BasketAccountNotice cart={cart} compact />

              <p className="ws-pdp-fineprint ws-muted">
                Collection from West Malling or UK mainland delivery. We do not
                ship parts and accessories outside mainland UK.
              </p>
            </div>
          </div>
        </div>

        {related.length > 0 ? (
          <section className="ws-pdp-related">
            <h2 className="ws-h3">More in {product.category_name}</h2>
            <div className="ws-grid--shop">
              {related.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  href={`/website/parts-catalog/${p.id}`}
                  inBasketQty={cart.qtyFor(p.id)}
                  onAdd={() => {
                    cart.add(p, 1);
                    setDrawerOpen(true);
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}

        <CartDrawer
          open={drawerOpen}
          cart={cart}
          onClose={() => setDrawerOpen(false)}
        />
      </ShopShell>
    </>
  );
}
