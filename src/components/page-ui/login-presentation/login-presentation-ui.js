import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { PRESENTATION_ROLES } from "@/config/presentationRoleAccess";

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
          padding: "32px 16px",
        }}
      >
        <div className="login-brand">
          <BrandLogo alt="HP Automotive" className="login-logo" />
        </div>

        <div
          className="app-section-card"
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "var(--layout-card-gap)",
            padding: "var(--section-card-padding)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                color: "var(--primary)",
                fontSize: "1.4rem",
                fontWeight: 700,
              }}
            >
              Presentation Mode
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                color: "var(--text-1)",
                fontSize: "0.9rem",
              }}
            >
              Choose a role to walk through the system as that user. The
              sidebar, top bar, and slide order will be scoped to the pages
              that role is granted in the access draft.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            {PRESENTATION_ROLES.map((role) => (
              <Link
                key={role.key}
                href={`/presentation?role=${role.key}`}
                className="app-btn app-btn--secondary"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "4px",
                  padding: "14px 16px",
                  textAlign: "left",
                  minHeight: 72,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    color: "var(--primary)",
                    fontSize: "0.95rem",
                  }}
                >
                  {role.label}
                </span>
                <span
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-1)",
                  }}
                >
                  {role.demoName} · {role.routes.length} pages
                </span>
              </Link>
            ))}
          </div>

          <div style={{ textAlign: "center" }}>
            <Link
              href="/login"
              className="app-btn app-btn--ghost"
              style={{ marginTop: "8px" }}
            >
              Back to staff login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
