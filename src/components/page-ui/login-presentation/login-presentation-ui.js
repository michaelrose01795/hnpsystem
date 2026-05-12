import Link from "next/link";import LayerSurface from "@/components/ui/LayerSurface";
import BrandLogo from "@/components/BrandLogo";
import { PRESENTATION_ROLES } from "@/config/presentationRoleAccess";

// Convert a Next.js route template (e.g. "/accounts/edit/[accountId]") into
// the human-readable slug segment used in the presentation deep-link form
// /presentation/<role>/<pageSlug>/<slide>. Slashes become dashes, bracketed
// dynamic params keep their identifier (without the brackets). The slug is
// purely informational — the [slide].js page resolves the actual real route
// from role.routes[slide] — but matching the doc's slugs keeps copy/paste
// from the doc working.
function routeToSlug(route) {
  return String(route || "")
    .replace(/^\//, "")
    .replace(/\//g, "-")
    .replace(/\[/g, "")
    .replace(/\]/g, "")
    || "home";
}

function firstSlideHref(role) {
  const firstRoute = role.routes?.[0] || "/";
  return `/presentation/${role.key}/${routeToSlug(firstRoute)}/0`;
}

export default function LoginPresentationPageUi() {
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

}
