// file location: src/features/website/components/WebsiteFooter.js
//
// The customer footer on every /website page (WebsitePage and StockShell):
// dealership contact details, opening hours, useful customer links, legal
// links, the authorised-retailer logos, then the FCA line, credit disclosure
// and copyright. Styling is custglobal.css @family marketing (.ws-footer*).
//
// Sources:
//   brand, footer      site chrome — live website_* rows, static fallback
//   contact            siteContent.contact (code-owned)
//   links              siteContent.customerLinks (code-owned)
//   brands             data/brands.js (code-owned)
//
// footer.legal arrives as plain strings (static) or { href, label } rows
// (live); resolveLegalLinks normalises both and keeps every link on the
// customer site. Every column drops out when its content is empty.

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import BrandLogo from "@/components/BrandLogo";
import { resolveLegalLinks } from "../legal/legalLinks";

const asList = (v) => (Array.isArray(v) ? v : []);

function FooterLink({ href, children }) {
  if (String(href).startsWith("/")) return <Link href={href}>{children}</Link>;
  const external = /^https?:/i.test(href);
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      {children}
    </a>
  );
}

export default function WebsiteFooter({ brand, contact, footer, brands, links }) {
  const name = brand?.name || "Humphries & Parks";
  // The first address line repeats the company name, which the logo already says.
  const address = asList(contact?.address).filter((line) => line && line !== name);
  const hours = [
    { label: "Sales", rows: asList(contact?.salesHours) },
    { label: "Service", rows: asList(contact?.serviceHours) },
  ].filter((group) => group.rows.length);
  const socials = asList(contact?.socials).filter((s) => s?.label && s?.href);
  const usefulLinks = asList(links).filter((l) => l?.label && l?.href);
  const legal = resolveLegalLinks(footer?.legal);
  const logos = asList(brands).filter((b) => b?.name && b?.logo);
  const year = new Date().getFullYear();

  return (
    <footer className="ws-footer">
      <div className="ws-container ws-footer-inner">
        <div className="ws-footer-top">
          <div className="ws-footer-col ws-footer-col--brand">
            <BrandLogo className="ws-logo" alt={name} />
            {brand?.tagline ? <p className="ws-footer-tagline">Family-run dealership · {brand.tagline}</p> : null}
            {address.length ? (
              <address className="ws-footer-address">
                {address.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </address>
            ) : null}
            {contact?.phone ? (
              <a href={contact.phoneHref || `tel:${contact.phone}`} className="ws-footer-tel">
                {contact.phone}
              </a>
            ) : null}
            {socials.length ? (
              <ul className="ws-footer-socials">
                {socials.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} target="_blank" rel="noreferrer" className="ws-btn ws-btn--ghost">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {hours.length ? (
            <div className="ws-footer-col">
              <h2 className="ws-footer-heading">Opening hours</h2>
              {hours.map((group) => (
                <dl key={group.label} className="ws-footer-hours">
                  <dt className="ws-footer-hours-label">{group.label}</dt>
                  {group.rows.map((row) => (
                    <dd key={row.days} className="ws-footer-hours-row">
                      <span>{row.days}</span>
                      <span>{row.time}</span>
                    </dd>
                  ))}
                </dl>
              ))}
            </div>
          ) : null}

          {usefulLinks.length ? (
            <nav className="ws-footer-col" aria-label="Useful links">
              <h2 className="ws-footer-heading">Useful links</h2>
              <ul className="ws-footer-links ws-footer-links--stack">
                {usefulLinks.map((l) => (
                  <li key={l.label}>
                    <FooterLink href={l.href}>{l.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {legal.length ? (
            <nav className="ws-footer-col" aria-label="Legal">
              <h2 className="ws-footer-heading">Legal</h2>
              <ul className="ws-footer-links ws-footer-links--stack">
                {legal.map((l) => (
                  <li key={l.label}>
                    <FooterLink href={l.href}>{l.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>

        {logos.length ? (
          <div className="ws-footer-brands">
            <span className="ws-footer-heading">Authorised retailer</span>
            <ul className="ws-footer-brand-list">
              {logos.map((b) => (
                <li key={b.name} className="ws-footer-brand">
                  <img src={b.logo} alt={b.name} loading="lazy" />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="ws-footer-base">
          {footer?.fcaReg ? <p className="ws-footer-legal">{footer.fcaReg}</p> : null}
          {footer?.creditDisclosure ? <p className="ws-footer-legal">{footer.creditDisclosure}</p> : null}
          <p className="ws-footer-copy">
            © {year} {name} Limited. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
