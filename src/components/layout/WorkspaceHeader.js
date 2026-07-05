import Link from "next/link";
import LayerSurface from "@/components/ui/LayerSurface";
import WorkspaceBreadcrumbs from "@/components/layout/WorkspaceBreadcrumbs";
import useWorkspaceShortcuts from "@/hooks/useWorkspaceShortcuts";
import {
  getWorkspaceHeader,
  getWorkspaceShortcutItems,
} from "@/config/workspace/manifest";

function ShortcutLink({ item, onClick }) {
  return (
    <Link
      href={item.href}
      onClick={() => onClick?.(item.href)}
      className="app-btn app-btn--secondary app-btn--xs"
      style={{
        minHeight: 36,
        justifyContent: "flex-start",
        textDecoration: "none",
      }}
    >
      {item.label}
    </Link>
  );
}

export default function WorkspaceHeader({ pathname, roles }) {
  const header = getWorkspaceHeader(pathname, roles);
  const shortcutItems = getWorkspaceShortcutItems(roles);
  const {
    favourites,
    recents,
    toggleFavourite,
    recordRecent,
    isFavourite,
  } = useWorkspaceShortcuts(shortcutItems);

  if (!header) return null;

  const activeHref = header.breadcrumbs?.[header.breadcrumbs.length - 1]?.href || header.home;
  const favouriteActive = activeHref ? isFavourite(activeHref) : false;
  const showShortcuts = favourites.length > 0 || recents.length > 0;

  return (
    <LayerSurface
      sectionKey="workspace-header"
      parentKey="app-layout-page-card"
      sectionType="content-card"
      backgroundToken="workspace-header"
      radius="var(--radius-lg)"
      padding="var(--section-card-padding)"
      gap="12px"
      style={{
        transform: "translateY(0)",
        transition: "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease",
        opacity: 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--layout-card-gap)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 220 }}>
          <WorkspaceBreadcrumbs
            pathname={pathname}
            roles={roles}
            trail={header.breadcrumbs}
            parentKey="workspace-header"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h1
              style={{
                margin: 0,
                color: "var(--text-1)",
                fontSize: "1.55rem",
                lineHeight: 1.12,
                letterSpacing: 0,
              }}
            >
              {header.label}
            </h1>
            <p
              style={{
                margin: 0,
                color: "var(--text-2)",
                fontSize: "0.9rem",
                lineHeight: 1.35,
              }}
            >
              {header.itemCount} workspace {header.itemCount === 1 ? "area" : "areas"}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "8px",
            flexWrap: "wrap",
            maxWidth: "100%",
          }}
        >
          {activeHref && (
            <button
              type="button"
              className={`app-btn ${favouriteActive ? "app-btn--primary" : "app-btn--secondary"} app-btn--xs`}
              onClick={() => toggleFavourite(activeHref)}
              aria-pressed={favouriteActive}
            >
              {favouriteActive ? "Saved" : "Save"}
            </button>
          )}
          {header.quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => recordRecent(action.href)}
              className="app-btn app-btn--primary app-btn--xs"
              style={{ textDecoration: "none", minHeight: 36 }}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {showShortcuts && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "8px",
          }}
        >
          {favourites.slice(0, 4).map((item) => (
            <ShortcutLink key={`fav-${item.href}`} item={item} onClick={recordRecent} />
          ))}
          {recents.slice(0, 4).map((item) => (
            <ShortcutLink key={`recent-${item.href}`} item={item} onClick={recordRecent} />
          ))}
        </div>
      )}
    </LayerSurface>
  );
}
