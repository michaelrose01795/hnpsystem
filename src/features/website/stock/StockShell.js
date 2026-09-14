// file location: src/features/website/stock/StockShell.js
// Chrome for the /website sub-pages that are not the single-scroll home page:
// /website/available-stock, /website/stock/<reg> and /website/valuation.
//
// Follows the established sub-page pattern from ShopShell: apply the
// html.website-scope class so custglobal.css resolves, wrap everything in
// .ws-page so the --ws-* tokens exist, then a compact nav and the site footer
// so a visitor who lands here from a search engine still has the phone number
// and a way back into the site. Every class is an existing custglobal .ws-*
// class — this file introduces no styling of its own.

import Head from "next/head";
import Link from "next/link";

import useWebsiteScope from "../hooks/useWebsiteScope";
import useWebsiteTheme from "../hooks/useWebsiteTheme";
import useWebsiteContent from "../hooks/useWebsiteContent";
import useCustomerSession from "../hooks/useCustomerSession";
import WebsiteTopBar from "../components/WebsiteTopBar";
import VehicleCompareBar from "../components/VehicleCompareBar";
import WebsiteFooter from "../components/WebsiteFooter";

/* ------------------------------------------------------------------ */
/* Live-content shape guards                                           */
/* ------------------------------------------------------------------ */
// Two content slots reach this component in a different shape depending on
// whether the static fallback or the live database is in play. The same guards
// exist in WebsitePage.js — see the longer note there for why, and for the
// real fix (make the DB rows and the static modules agree).

// The brand singleton is the one slot getWebsiteContent passes through raw
// (`brand: brand || {}`), so live content arrives as the snake_case DB row
// while the static fallback is camelCase.
//
// The MARK itself no longer comes from that row: nav and footer render
// <BrandLogo>, the same local wordmark (/images/logo/Logo.png) the staff
// sidebar shows in its expanded state, theme-recoloured to the active accent.
// Only the name is still read from content, as the logo's alt text and in the
// copyright line.
const brandName = (brand) => brand?.name || "Humphries & Parks";

// footer.legal is plain strings from the static fallback and { href, label }
// rows from website_footer. WebsiteFooter — the same footer the home page
// renders — normalises both and keeps every link on the customer site.

// `backToSite` collapses the two nav links into a single "Back to site" link.
// Used by /website/valuation, where "Sell your car" points at the page the
// visitor is already on — a link to nowhere sat beside the phone button.
export default function StockShell({ title, description, backToSite = false, children }) {
  useWebsiteScope();

  const { content } = useWebsiteContent();
  const { brand, contact, footer, customerLinks } = content.siteContent;
  const name = brandName(brand);
  const { design } = content;
  const { loading: sessionLoading, customer } = useCustomerSession();

  useWebsiteTheme();

  return (
    <>
      <Head>
        <title>{title}</title>
        {description ? <meta name="description" content={description} /> : null}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="ws-page" data-presentation="website-stock-page">
        {/* No "Contact" link here on purpose — the phone button IS the
            contact route, and two of them read as a choice the visitor does
            not have to make. The footer still links back into the site. */}
        <WebsiteTopBar
          dataPresentation="website-stock-nav"
          brandAlt={name}
          contact={contact}
          design={design}
          sessionLoading={sessionLoading}
          customer={customer}
        >
          {backToSite ? (
            <Link href="/website" className="ws-nav-link">
              Back to site
            </Link>
          ) : (
            <>
              <Link href="/website/available-stock" className="ws-nav-link">
                Available stock
              </Link>
              <Link href="/website/valuation" className="ws-nav-link">
                Sell your car
              </Link>
            </>
          )}
        </WebsiteTopBar>

        <main>{children}</main>

        {/* Compare tray for the stock cards; renders nothing until one is added. */}
        <VehicleCompareBar />

        <WebsiteFooter
          brand={brand}
          contact={contact}
          footer={footer}
          brands={content.brands}
          links={customerLinks}
        />
      </div>
    </>
  );
}
