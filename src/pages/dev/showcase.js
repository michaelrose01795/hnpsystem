// file location: src/pages/dev/showcase.js
//
// Design-system showcase. Source of truth for every approved UI family and
// variant. Future AI or human refactor passes should reference this page
// instead of guessing at what's approved.
//
// Gated by the same role check as the dev overlay (canUseDevLayoutOverlay).
// If a user lands here without access, they see a bounce message instead of
// the gallery.
//
// Content is driven by src/components/ui/variants.js — do NOT hardcode a
// second copy of variant metadata here.
import React, { useMemo } from "react";
import Head from "next/head";
import { useUser } from "@/context/UserContext";
import { canUseDevLayoutOverlay } from "@/lib/dev-layout/access";
import { UI_FAMILIES } from "@/components/ui/variants";

const sectionStyle = {
  marginBottom: 28,
  padding: "18px 20px",
  background: "var(--section-card-bg)",
  borderRadius: "var(--section-card-radius)",
};

const variantRowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(160px, 200px) minmax(220px, 1fr) minmax(220px, 1fr)",
  gap: 12,
  alignItems: "start",
  padding: "12px 0",
  borderTop: "1px solid var(--table-border)",
};

const codeBlockStyle = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 11,
  background: "var(--layer-section-level-1)",
  padding: "6px 8px",
  borderRadius: 6,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  margin: 0,
};

// Render a small live example for each variant. We keep this minimal —
// families without a dedicated preview fall back to a named class chip.
function renderVariantPreview(familyId, variant) {
  const common = { className: variant.className };
  switch (familyId) {
    case "button":
      return <button type="button" {...common}>Button</button>;
    case "badge":
      return <span {...common}>Badge</span>;
    case "tabs":
      return <span {...common} role="tab" aria-selected="false">Tab</span>;
    case "toolbar":
      return (
        <div {...common}>
          <span style={{ fontSize: 12 }}>Toolbar</span>
        </div>
      );
    case "empty-state":
      return (
        <div {...common} style={{ minHeight: 60 }}>
          <p className="app-empty-state__title">No results</p>
          <p className="app-empty-state__description">Try a different filter.</p>
        </div>
      );
    case "toast":
      return (
        <div {...common}>
          <span className="app-toast__icon">i</span>
          <span>Example toast message</span>
        </div>
      );
    case "input":
      if (variant.id === "textarea") {
        return <textarea {...common} placeholder="Textarea" rows={2} />;
      }
      if (variant.id === "select") {
        return (
          <select {...common}>
            <option>Option A</option>
            <option>Option B</option>
          </select>
        );
      }
      return <input type="text" {...common} placeholder={variant.id} />;
    case "toggle":
      if (variant.id === "switch") {
        return <button type="button" {...common} aria-checked="true" role="switch" />;
      }
      return <input type={variant.id === "radio" ? "radio" : "checkbox"} {...common} />;
    case "card":
      return (
        <div {...common} style={{ padding: 12, minHeight: 52 }}>
          <span style={{ fontSize: 12 }}>Card surface</span>
        </div>
      );
    case "loader":
      return (
        <div
          {...common}
          style={{
            minHeight: 14,
            minWidth: 120,
            background: "var(--skeleton-base)",
            borderRadius: "var(--skeleton-radius)",
          }}
        />
      );
    default:
      return (
        <span
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11,
            opacity: 0.7,
          }}
        >
          (no preview)
        </span>
      );
  }
}

function FamilyBlock({ family }) {
  return (
    <section id={family.id} style={sectionStyle}>
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "var(--accentMain)" }}>
          {family.label}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
          {family.description}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>
          CSS: <code>{family.cssFile}</code>
          {family.component ? <> · Component: <code>{family.component}</code></> : null}
          {" · Trace colour: "}
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              background: family.traceColor,
              borderRadius: 2,
              verticalAlign: "middle",
            }}
          />{" "}
          <code>{family.traceColor}</code>
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(160px, 200px) minmax(220px, 1fr) minmax(220px, 1fr)",
          gap: 12,
          paddingBottom: 4,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--text-secondary)",
        }}
      >
        <span>Variant</span>
        <span>Preview</span>
        <span>Usage</span>
      </div>

      {family.variants.map((variant) => (
        <div key={variant.id} style={variantRowStyle}>
          <div>
            <strong style={{ fontSize: 13 }}>{variant.id}</strong>
            <p style={{ margin: "2px 0 6px", fontSize: 12, color: "var(--text-secondary)" }}>
              {variant.description}
            </p>
            <pre style={codeBlockStyle}>{variant.className}</pre>
          </div>
          <div>{renderVariantPreview(family.id, variant)}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {variant.usage}
            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>
              Status: <strong>{variant.status}</strong>
            </div>
          </div>
        </div>
      ))}

      {family.sizes ? (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 13, margin: 0, color: "var(--text-secondary)" }}>Sizes</h3>
          <ul style={{ margin: "6px 0", paddingLeft: 18, fontSize: 12 }}>
            {family.sizes.map((size) => (
              <li key={size.id}>
                <strong>{size.id}</strong>
                {size.className ? <> · <code>{size.className}</code></> : null}
                {" — "}{size.description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {family.shapes ? (
        <div style={{ marginTop: 8 }}>
          <h3 style={{ fontSize: 13, margin: 0, color: "var(--text-secondary)" }}>Shapes</h3>
          <ul style={{ margin: "6px 0", paddingLeft: 18, fontSize: 12 }}>
            {family.shapes.map((shape) => (
              <li key={shape.id}>
                <strong>{shape.id}</strong>
                {shape.className ? <> · <code>{shape.className}</code></> : null}
                {" — "}{shape.description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {family.customOnly && family.customOnly.length ? (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: "var(--warning-surface)",
            color: "var(--warning-text)",
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          <strong>Keep custom, do not standardise:</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {family.customOnly.map((item, idx) => (
              <li key={idx}>
                {item.description}
                {item.reason ? <> — <em>{item.reason}</em></> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default function ShowcasePage() {
  const { user, loading } = useUser();
  const canAccess = useMemo(() => canUseDevLayoutOverlay(user), [user]);

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ color: "var(--accentMain)" }}>Design system showcase</h1>
        <p>
          This page is restricted to roles that can use the dev overlay. Ask an
          admin if you need access.
        </p>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>Design system showcase · HNPSystem</title>
      </Head>
      <main
        className="app-page-shell"
        style={{ padding: "16px 20px 40px", minHeight: "100vh" }}
      >
        <div className="app-page-card" style={{ padding: 24 }}>
          <header style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0, color: "var(--accentMain)" }}>
              HNPSystem · Design system showcase
            </h1>
            <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", maxWidth: 720 }}>
              The authoritative reference for every approved UI family and variant.
              Page-by-page cleanup should use the variants listed here before
              creating anything new. If a pattern is missing, add it to{" "}
              <code>src/components/ui/variants.js</code> first.
            </p>
            <nav style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {UI_FAMILIES.map((family) => (
                <a
                  key={family.id}
                  href={`#${family.id}`}
                  className="app-btn app-btn--secondary app-btn--xs app-btn--pill"
                  style={{ textDecoration: "none" }}
                >
                  {family.label}
                </a>
              ))}
            </nav>
          </header>

          {UI_FAMILIES.map((family) => (
            <FamilyBlock key={family.id} family={family} />
          ))}
        </div>
      </main>
    </>
  );
}
