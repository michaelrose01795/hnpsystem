import Link from "next/link";
import LayerSurface from "@/components/ui/LayerSurface";
import BrandLogo from "@/components/BrandLogo";
import { PRESENTATION_ROLES } from "@/config/presentationRoleAccess";
import { preloadRealPages } from "@/features/presentation/runtime/realPageLoader";

// Warms the JS modules behind every page in the role's deck the moment the
// user shows intent on a tile (hover / focus / touch). By the time they
// actually click, the first slide and every subsequent slide they navigate
// to should already be in the webpack module cache — no loading flash.
function preloadRoleDeck(role) {
  if (!role?.routes?.length) return;
  preloadRealPages(role.routes);
}

// Convert a Next.js route template (e.g. "/accounts/edit/[accountId]") into
// the human-readable slug segment used in the presentation deep-link form
// /presentation/<role>/<pageSlug>/<slide>. Slashes become dashes, bracketed
// dynamic params keep their identifier (without the brackets). The slug is
// purely informational — the [slide].js page resolves the actual real route
// from role.routes[slide] — but matching the doc's slugs keeps copy/paste
// from the doc working.
function routeToSlug(route) {
  const [path, query = ""] = String(route || "").split("?");
  const base = path
    .replace(/^\//, "")
    .replace(/\//g, "-")
    .replace(/\[/g, "")
    .replace(/\]/g, "")
    || "home";
  const querySuffix = query
    ? `-${query.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`
    : "";
  return `${base}${querySuffix}`;
}

function firstSlideHref(role) {
  const firstRoute = role.routes?.[0] || "/";
  return `/presentation/${role.key}/${routeToSlug(firstRoute)}/0`;
}

export default function LoginPresentationPageUi(props = {}) {
  const { view = "section2", onSelectRole } = props;

  switch (view) {
    // Shown the instant a deck is chosen — a centred "Loading presentation"
    // splash with a spinner, instead of the full-page 3-section skeleton
    // which doesn't match the presentation deck shape it transitions into.
    case "section1":
      return (
        <div
          role="status"
          aria-live="polite"
          aria-label="Loading presentation"
          className="login-page-wrapper"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            width: "100%"
          }}>

          <style>{`@keyframes presentation-spin{to{transform:rotate(360deg)}}`}</style>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px"
            }}>

            <svg
              aria-hidden="true"
              width="44"
              height="44"
              viewBox="0 0 44 44"
              style={{
                animation: "presentation-spin 0.9s linear infinite",
                display: "block"
              }}>

              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="var(--surface)"
                strokeWidth="3" />

              <path
                d="M22 4 a18 18 0 0 1 18 18"
                fill="none"
                stroke="var(--accentMain)"
                strokeWidth="3"
                strokeLinecap="round" />

            </svg>

            <span
              style={{
                color: "var(--primary)",
                fontWeight: 600,
                fontSize: "1rem"
              }}>

              Loading presentation
            </span>
          </div>
        </div>);

    case "section2":
      return (
        <div className="login-page-wrapper">
          <div
            className="login-center-stage"
            style={{
              width: "100%",
              maxWidth: 1080,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--page-stack-gap)",
              padding: "32px 16px"
            }}>

            <div className="login-brand">
              <BrandLogo alt="HP Automotive" className="login-logo" />
            </div>

            <LayerSurface as="div"

            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "var(--layout-card-gap)",
              padding: "var(--section-card-padding)"
            }}>

              <div style={{ textAlign: "center" }}>
                <h1
                  style={{
                    margin: 0,
                    color: "var(--primary)",
                    fontSize: "1.4rem",
                    fontWeight: 700
                  }}>

                  Presentation Mode
                </h1>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px"
                }}>

                {PRESENTATION_ROLES.map((role) =>
                <Link
                  key={role.key}
                  href={firstSlideHref(role)}
                  prefetch
                  onMouseEnter={() => preloadRoleDeck(role)}
                  onFocus={() => preloadRoleDeck(role)}
                  onTouchStart={() => preloadRoleDeck(role)}
                  onClick={(event) => {
                    preloadRoleDeck(role);
                    onSelectRole?.(event, role);
                  }}
                  className="app-btn app-btn--secondary"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "4px",
                    padding: "14px 16px",
                    textAlign: "left",
                    minHeight: 72
                  }}>

                    <span
                    style={{
                      fontWeight: 700,
                      color: "var(--primary)",
                      fontSize: "0.95rem"
                    }}>

                      {role.label}
                    </span>
                    <span
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--text-1)"
                    }}>

                      {role.demoName} · {role.routes.length} pages
                    </span>
                  </Link>
                )}
              </div>

              <div style={{ textAlign: "center" }}>
                <Link
                  href="/login"
                  className="app-btn app-btn--ghost"
                  style={{ marginTop: "8px" }}>

                  Back to staff login
                </Link>
              </div>
            </LayerSurface>
          </div>
        </div>);

    default:
      return null;
  }
}
