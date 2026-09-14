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
// The bar must sit inside a .ws-page that wraps the WHOLE page: the --ws-*
// tokens live there, and a sticky header only sticks within its parent. The
// next sibling (`main` or the page shell) takes the capped gap beneath it — see
// "Gap under the top bar" in custglobal.css.
//
// Contact is code-owned (codeOwnedContent.js), so pages that do not load site
// content fall back to the static module and render the same phone number.

import Link from "next/link";

import BrandLogo from "@/components/BrandLogo";
import { siteContent as staticSiteContent } from "../data/siteContent";
import { design as staticDesign } from "../data/siteDesign";
import WebsiteNavActions, { WebsiteDevNavControls } from "./WebsiteNavActions";

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
  const showPhone = design?.showNavPhone !== false;
  const logo = <BrandLogo className="ws-logo" alt={alt} priority />;

  let linksClassName = "ws-nav-links";
  if (menu?.open) linksClassName += " ws-nav-links--open";

  return (
    <header
      className={`${menu ? "ws-nav" : "ws-nav ws-nav--shop"}${className ? ` ${className}` : ""}`}
      data-presentation={dataPresentation}
    >
      <div className="ws-nav-inner">
        {brandHref.startsWith("#") ? (
          <a href={brandHref} className="ws-brand" onClick={onNavigate}>
            {logo}
          </a>
        ) : (
          <Link href={brandHref} className="ws-brand" onClick={onNavigate}>
            {logo}
          </Link>
        )}

        <nav className={linksClassName} aria-label={label}>
          {children}
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
