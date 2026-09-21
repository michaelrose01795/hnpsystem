// file location: src/features/website/components/WebsiteTopBar.js
//
// THE top bar for every /website page. One design everywhere:
//
//   left   — the brand logo (back to /website)
//   middle — the links for the page the visitor is on (`children`)
//   right  — WebsiteNavActions: dev-only Dev / Overlay, the phone number, then
//            Account (signed in) or Login
//
// Only the middle changes from page to page. The home page additionally passes
// `menu` for its phone hamburger; every other page uses the .ws-nav--shop grid,
// whose links stay visible and wrap on a phone instead.
//
// On the .ws-nav--shop bar the middle links are balanced on the centre of the
// screen: with an odd count the middle link sits dead centre, with an even
// count the gap between the two middle links does. See balanceLinks below and
// "Balanced middle links" in custglobal.css.
//
// The bar must sit inside a .ws-page that wraps the WHOLE page: the --ws-*
// tokens live there, and a sticky header only sticks within its parent. The
// next sibling (`main` or the page shell) takes the capped gap beneath it — see
// "Gap under the top bar" in custglobal.css.
//
// Contact is code-owned (codeOwnedContent.js), so pages that do not load site
// content fall back to the static module and render the same phone number.

import { Children, Fragment, cloneElement, isValidElement } from "react";
import Link from "next/link";

import BrandLogo from "@/components/BrandLogo";
import { siteContent as staticSiteContent } from "../data/siteContent";
import { design as staticDesign } from "../data/siteDesign";
import WebsiteNavActions, { WebsiteDevNavControls } from "./WebsiteNavActions";
import WebsiteIcon from "./WebsiteIcon";
import { BasketButton } from "@/features/website/shop/BasketSummary";
import { useShopCartCount } from "@/features/website/hooks/useShopCart";

// A dropdown of links in a top bar (the home page folds its links with
// groupNavLinks / NAV_GROUPS from data/siteDesign.js). Controlled: the page
// holds which group is open, so opening one closes the others and closing the
// phone menu closes them all. Above the phone breakpoint the menu floats under
// its trigger; inside the phone Menu panel the same markup opens inline.
export function WebsiteNavGroup({ id, label, active = false, open = false, onToggle, children }) {
  const menuId = `ws-nav-menu-${id}`;
  return (
    <div className={open ? "ws-nav-group ws-nav-group--open" : "ws-nav-group"} data-nav-group={id}>
      <button
        type="button"
        className={active ? "ws-nav-group-trigger ws-nav-group-trigger--active" : "ws-nav-group-trigger"}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={onToggle}
      >
        {label}
        <WebsiteIcon name="chevron" className="ws-nav-caret" />
      </button>
      <div id={menuId} className="ws-nav-menu" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

// Pages pass links directly or inside a fragment (StockShell), so fragments are
// unwrapped to count the real links. Keys are prefixed so two fragments cannot
// hand the same side colliding keys.
function flattenLinks(children, prefix = "") {
  return Children.toArray(children).flatMap((child) => {
    if (isValidElement(child) && child.type === Fragment) {
      return flattenLinks(child.props.children, `${prefix}${child.key}`);
    }
    return isValidElement(child) ? [cloneElement(child, { key: `${prefix}${child.key}` })] : [child];
  });
}

// Splits the links into [start][pivot][end] so the pivot (odd count) or the
// seam between the two halves (even count) lands on the centre of the bar.
function balanceLinks(children) {
  const links = flattenLinks(children);
  const half = Math.floor(links.length / 2);
  const odd = links.length % 2 === 1;
  return (
    <>
      <div className="ws-nav-links__side ws-nav-links__side--start">{links.slice(0, half)}</div>
      {odd ? links[half] : null}
      <div className="ws-nav-links__side ws-nav-links__side--end">{links.slice(odd ? half + 1 : half)}</div>
    </>
  );
}

export default function WebsiteTopBar({
  children,
  label = "Site",
  brandHref = "/website",
  brandAlt,
  contact = staticSiteContent.contact || {},
  design = staticDesign,
  sessionLoading = false,
  customer = null,
  loginHref,
  onNavigate,
  // Home page only: { open, onToggle } adds the phone hamburger menu.
  menu = null,
  // Optional second row under the bar (e.g. the /website/profile greeting and
  // actions), so it sticks with the bar. `className` adds a page hook.
  subbar = null,
  className = "",
  dataPresentation = "website-nav",
}) {
  const alt = brandAlt || staticSiteContent.brand?.name || "Humphries & Parks";
  const basketCount = useShopCartCount();
  const showPhone = design?.showNavPhone !== false;
  const logo = <BrandLogo className="ws-logo" alt={alt} priority />;

  let linksClassName = "ws-nav-links";
  if (menu?.open) linksClassName += " ws-nav-links--open";
  if (!menu) {
    linksClassName +=
      flattenLinks(children).length % 2 === 1 ? " ws-nav-links--balanced" : " ws-nav-links--balanced ws-nav-links--even";
  }

  return (
    <header
      className={`${menu ? "ws-nav" : "ws-nav ws-nav--shop"}${className ? ` ${className}` : ""}`}
      data-presentation={dataPresentation}
    >
      <div className="ws-nav-inner">
        <div className="ws-brand">
        {brandHref.startsWith("#") ? (
          <a href={brandHref} onClick={onNavigate}>
            {logo}
          </a>
        ) : (
          <Link href={brandHref} onClick={onNavigate}>
            {logo}
          </Link>
        )}
        <BasketButton count={basketCount} onNavigate={onNavigate} />
        </div>

        <nav className={linksClassName} aria-label={label}>
          {menu ? children : balanceLinks(children)}
          {menu ? (
            // Phone menu only (custglobal hides this above 640px): the bar is
            // too narrow there for the phone number and dev controls.
            <div className="ws-nav-menu-extras">
              <WebsiteDevNavControls onNavigate={onNavigate} />
              {showPhone && contact.phone ? (
                <a href={contact.phoneHref || `tel:${contact.phone}`} className="ws-nav-phone" onClick={onNavigate}>
                  {contact.phone}
                </a>
              ) : null}
            </div>
          ) : null}
        </nav>

        {menu ? (
          <button
            type="button"
            className="ws-nav-toggle"
            aria-expanded={menu.open}
            aria-label={menu.open ? "Close menu" : "Open menu"}
            onClick={menu.onToggle}
          >
            {menu.open ? "Close" : "Menu"}
          </button>
        ) : null}

        {/* Far-right corner: [Dev] [Overlay] [phone] [Account]. */}
        <WebsiteNavActions
          phone={contact.phone}
          phoneHref={contact.phoneHref}
          showPhone={showPhone}
          showAccount={design?.showNavAccount !== false}
          sessionLoading={sessionLoading}
          customer={customer}
          loginHref={loginHref}
          onNavigate={onNavigate}
        />
      </div>
      {subbar}
    </header>
  );
}
