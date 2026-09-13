// file location: src/features/website/components/WebsiteNavActions.js
//
// The right-hand cluster of every /website top bar (home, shop and stock shells),
// read left to right:
//
//   [Dev] [Overlay]   dev branch / Vercel preview / local only
//   [phone]           always directly left of the account button
//   [Account|Login]   pinned to the far-right corner
//
// Dev opens the /website/dev showcase. Overlay switches the dev layout overlay
// on and off for /website (the same switch as typing "/website-dev"). Both use
// the environment gate the staff sidebar's Dev / Overlay buttons use, and both
// render only after mount: the branch and deploy variables are not all inlined
// into the client bundle, so a server render could disagree with the browser.
//
// `WebsiteDevNavControls` is exported on its own for the home page's mobile menu,
// where the bar is too narrow to carry them.

import { useEffect, useState } from "react";
import Link from "next/link";
import { canShowDevPages } from "@/lib/dev-tools/config";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function WebsiteDevNavControls({ onNavigate }) {
  const mounted = useMounted();
  const { canAccess, isWebsiteSurface, enabled, toggleWebsiteOverlay } = useDevLayoutOverlay();
  if (!mounted) return null;

  const showDevLink = canShowDevPages();
  const showOverlayToggle = canAccess && isWebsiteSurface;
  if (!showDevLink && !showOverlayToggle) return null;

  return (
    <>
      {showDevLink ? (
        <Link
          href="/website/dev"
          className="ws-nav-account ws-nav-dev"
          // Stays clickable while the overlay is intercepting clicks on the page.
          data-dev-overlay-passthrough="1"
          onClick={onNavigate}
        >
          Dev
        </Link>
      ) : null}
      {showOverlayToggle ? (
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle dev layout overlay"
          className={enabled ? "ws-nav-account ws-nav-dev ws-nav-dev--on" : "ws-nav-account ws-nav-dev"}
          data-dev-overlay-passthrough="1"
          onClick={() => toggleWebsiteOverlay()}
        >
          Overlay
        </button>
      ) : null}
    </>
  );
}

export default function WebsiteNavActions({
  phone,
  phoneHref,
  showPhone = true,
  showAccount = true,
  sessionLoading = false,
  customer = null,
  loginHref = "/website/login",
  onNavigate,
}) {
  return (
    <div className="ws-nav-actions">
      <WebsiteDevNavControls onNavigate={onNavigate} />
      {showPhone && phone ? (
        <a href={phoneHref || `tel:${phone}`} className="ws-nav-phone" onClick={onNavigate}>
          {phone}
        </a>
      ) : null}
      {!showAccount || sessionLoading ? null : customer ? (
        <Link href="/website/profile" className="ws-nav-account ws-nav-account--profile" onClick={onNavigate}>
          Account
        </Link>
      ) : (
        <Link href={loginHref} className="ws-nav-account" onClick={onNavigate}>
          Login
        </Link>
      )}
    </div>
  );
}
