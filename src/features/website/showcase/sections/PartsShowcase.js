// file location: src/features/website/showcase/sections/PartsShowcase.js
//
// /website/dev — @family parts: /website/parts-catalog and the product detail
// page. Markup mirrors src/features/website/shop/PartsCatalogPage.js,
// PartDetailPage.js, ShopShell.js and BasketAccountNotice.js; ProductCard and
// ProductMedia are the real components.

import { useState } from "react";
import WebsiteNativeSelect from "@/features/website/components/WebsiteNativeSelect";
import ProductCard, { ProductMedia } from "@/features/website/shop/ProductCard";
import { shopCategories, shopProducts } from "@/features/website/data/shopProducts";
import { formatGbp } from "@/features/website/hooks/useShopCart";
import { Frame, Row, ShowcaseSection } from "../ShowcasePrimitives";

const SORTS = [
  { value: "relevance", label: "Most relevant" },
  { value: "price-asc", label: "Price, low to high" },
];

export default function PartsShowcase({ section }) {
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("relevance");
  const product = shopProducts[0] || { id: "demo", sku: "SZ-DEMO", name: "Demo part", price_pence: 1000, stock_qty: 4 };
  const categoryOptions = shopCategories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <ShowcaseSection id="parts" section={section}>
      <Row label="Catalogue head" note=".ws-shop-head · .ws-breadcrumb (the basket button lives in the shop top bar)">
        <Frame padded>
          <div className="ws-page">
            <nav className="ws-breadcrumb" aria-label="Breadcrumb">
              <a href="#marketing">Home</a>
              <span aria-hidden="true">/</span>
              <span className="ws-breadcrumb-current">Parts catalogue</span>
            </nav>
            <header className="ws-head ws-shop-head">
              <div>
                <span className="ws-eyebrow">Genuine parts</span>
                <h3 className="ws-h2">Parts catalogue</h3>
              </div>
            </header>
          </div>
        </Frame>
      </Row>

      <Row label="Basket notices" note=".ws-basket-notice · --compact · --ok">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-basket-notice">
              <span>
                Your basket is saved on this device. <strong>Sign in to keep it</strong> and check out faster.
              </span>
              <a href="#auth" className="ws-btn ws-btn--ghost">
                Sign in
              </a>
            </div>
            <div className="ws-basket-notice ws-basket-notice--compact">
              <span>Compact variant used inside the basket drawer.</span>
            </div>
            <p className="ws-basket-notice ws-basket-notice--ok">Saved to your account — pick it up on any device.</p>
          </div>
        </Frame>
      </Row>

      <Row label="Catalogue controls" note=".ws-catalog-controls · -search · -category · -sort · -summary · button.ws-catalog-clear">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-catalog-controls">
              <div className="ws-catalog-search">
                <label className="ws-sr-only" htmlFor="dev-catalog-search">
                  Search parts
                </label>
                <input id="dev-catalog-search" type="search" placeholder="Search by part name or number" />
              </div>
              <div className="ws-catalog-category">
                <WebsiteNativeSelect value={category} onChange={setCategory} options={categoryOptions} placeholder="All categories" />
              </div>
              <div className="ws-catalog-sort">
                <WebsiteNativeSelect value={sort} onChange={setSort} options={SORTS} />
              </div>
            </div>
            <div className="ws-catalog-summary">
              <span className="ws-muted">Showing 24 of 124 parts</span>
              <button type="button" className="ws-catalog-clear">
                Clear search
              </button>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Grid, empty and more" note="ProductCard (generic part-type image) · .ws-catalog-empty · .ws-shop-more">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-grid--shop">
              <ProductCard product={product} href="#parts" />
            </div>
            <div className="ws-catalog-empty">
              <p className="ws-muted">
                Nothing matched. Call parts on{" "}
                <a href="tel:01732870711" className="ws-catalog-phone">
                  01732 870711
                </a>
              </p>
            </div>
            <div className="ws-shop-more">
              <p className="ws-muted">A selection of what we stock.</p>
              <a href="#parts" className="ws-btn ws-btn--primary">
                Show all parts
              </a>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Product detail" note=".ws-pdp · -media · -info · -specs · -buy · -qty · -related">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-pdp">
              <div className="ws-pdp-media">
                <ProductMedia product={product} />
              </div>
              <div className="ws-pdp-info">
                <dl className="ws-pdp-specs">
                  <div className="ws-pdp-spec">
                    <dt>Part number</dt>
                    <dd>{product.sku}</dd>
                  </div>
                  <div className="ws-pdp-spec">
                    <dt>Category</dt>
                    <dd>
                      <a href="#parts">Servicing</a>
                    </dd>
                  </div>
                </dl>
                <p className="ws-pdp-description">{product.description || "Genuine manufacturer part."}</p>
                <div className="ws-pdp-buy">
                  <p className="ws-product-price ws-pdp-price">
                    {formatGbp(product.price_pence)}
                    <span className="ws-pdp-price-note">incl. VAT</span>
                  </p>
                  <div className="ws-pdp-qty">
                    <label htmlFor="dev-pdp-qty">Quantity</label>
                    <div className="ws-pdp-qty-controls">
                      <button type="button" className="ws-cart-qty" aria-label="Decrease">
                        −
                      </button>
                      <input id="dev-pdp-qty" type="number" defaultValue={1} />
                      <button type="button" className="ws-cart-qty" aria-label="Increase">
                        +
                      </button>
                    </div>
                  </div>
                  <button type="button" className="ws-btn ws-btn--primary ws-pdp-cta">
                    Add to basket
                  </button>
                  <p className="ws-muted ws-pdp-inbasket">1 already in your basket</p>
                  <p className="ws-pdp-fineprint ws-muted">Fitting available in our workshop.</p>
                </div>
              </div>
            </div>
            <section className="ws-pdp-related">
              <h3 className="ws-h3">More in Servicing</h3>
              <div className="ws-grid--shop">
                {shopProducts.slice(1, 3).map((related) => (
                  <ProductCard key={related.id} product={related} href="#parts" />
                ))}
              </div>
            </section>
          </div>
        </Frame>
      </Row>
    </ShowcaseSection>
  );
}
