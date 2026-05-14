// file location: src/pages/vision/_components/VisionLayout.js
// Shared mock-only Vision layout. It does not read or write live DMS data.

import React, { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import LayerTheme from "@/components/ui/LayerTheme";
import { visionNav } from "../data/visionMockData";

const styles = {
  shell: { maxWidth: "var(--page-max-width)", margin: "0 auto", width: "100%" },
  grid: { display: "grid", gridTemplateColumns: "minmax(220px, 280px) minmax(0, 1fr)", gap: "var(--page-stack-gap)" },
  navGroup: { display: "grid", gap: "var(--space-xs)" },
  groupTitle: { fontSize: "0.78rem", fontWeight: 800, color: "var(--surfaceTextMuted)", textTransform: "uppercase", marginTop: "var(--space-sm)" },
  main: { minWidth: 0, display: "grid", gap: "var(--page-stack-gap)" },
};

export default function VisionLayout({ slug, children }) {
  const router = useRouter();
  const groupedNav = useMemo(() => {
    return visionNav.reduce((groups, item) => {
      groups[item.group] = groups[item.group] || [];
      groups[item.group].push(item);
      return groups;
    }, {});
  }, []);

  const activeSlug = slug || "";
  return (
    <div style={styles.shell}>
      <div style={styles.grid}>
        <LayerTheme as="nav" aria-label="Vision navigation">
          <Link className={`app-btn app-btn--nav app-btn--secondary ${router.pathname === "/vision" ? "is-active" : ""}`} href="/vision">
            Vision home
          </Link>
          {Object.entries(groupedNav).map(([group, items]) => (
            <div key={group} style={styles.navGroup}>
              <div style={styles.groupTitle}>{group}</div>
              {items.map((item) => (
                <Link
                  key={item.slug}
                  className={`app-btn app-btn--nav app-btn--secondary ${activeSlug === item.slug ? "is-active" : ""}`}
                  href={`/vision/${item.slug}`}
                >
                  {item.title}
                </Link>
              ))}
            </div>
          ))}
        </LayerTheme>
        <main style={styles.main}>{children}</main>
      </div>
    </div>
  );
}
