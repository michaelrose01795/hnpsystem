import Link from "next/link";
import { getBreadcrumbTrail } from "@/config/workspace/manifest";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function WorkspaceBreadcrumbs({
  pathname,
  roles,
  trail: providedTrail = null,
  parentKey = "workspace-header",
}) {
  const trail = providedTrail || getBreadcrumbTrail(pathname, roles);
  if (!trail?.length) return null;

  return (
    <DevLayoutSection
      as="nav"
      sectionKey="workspace-breadcrumbs"
      parentKey={parentKey}
      sectionType="navigation"
      backgroundToken="workspace-breadcrumbs"
      aria-label="Breadcrumb"
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "6px",
        minWidth: 0,
        color: "var(--text-2)",
        fontSize: "0.82rem",
        lineHeight: 1.3,
      }}
    >
      {trail.map((crumb, index) => {
        const isLast = index === trail.length - 1;
        const key = `${crumb.label}-${crumb.href || index}`;
        return (
          <span
            key={key}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", minWidth: 0 }}
          >
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                style={{
                  color: "var(--accentText)",
                  textDecoration: "none",
                  fontWeight: 700,
                  minHeight: 32,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                style={{
                  color: isLast ? "var(--text-1)" : "var(--text-2)",
                  fontWeight: isLast ? 700 : 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {crumb.label}
              </span>
            )}
            {!isLast && <span aria-hidden="true">/</span>}
          </span>
        );
      })}
    </DevLayoutSection>
  );
}
