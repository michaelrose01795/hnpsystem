// file location: src/components/CookieBanner.js
//
// Pinned bottom-of-page banner that captures the visitor's cookie consent
// once. Reject parity is non-negotiable under PECR — the "Reject all"
// button is the same prominence as "Accept all". A "Customise" panel lets
// the visitor pick categories.
//
// Storage:
//   - localStorage 'hnp.cookieConsent.v1' — the consent record (categories
//     + timestamp + anonymousId). Used to hide the banner on subsequent
//     visits.
//   - first-party cookie 'hnp_anon_id' (1 year) — stable anonymous id
//     mirrored to /api/cookies/consent for evidential proof.
//
// Mounted from src/pages/_app.js next to GlobalNotesWidget.

import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "hnp.cookieConsent.v1";
const ANON_COOKIE = "hnp_anon_id";
const POLICY_VERSION = "v1.0";
const COOKIE_TTL_DAYS = 365;

const CATEGORIES = [
  {
    key: "essential",
    label: "Essential",
    description:
      "Required for the site to work. Sign-in, security, and accessibility settings.",
    locked: true,
  },
  {
    key: "preferences",
    label: "Preferences",
    description: "Remember choices like theme and last-viewed pages.",
    locked: false,
  },
  {
    key: "analytics",
    label: "Analytics",
    description: "Help us understand how the site is used so we can improve it.",
    locked: false,
  },
  {
    key: "marketing",
    label: "Marketing",
    description: "Used for promotional messages and audience measurement.",
    locked: false,
  },
];

const generateUuid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const setCookie = (name, value, days) => {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

const readCookie = (name) => {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length));
      } catch {
        return null;
      }
    }
  }
  return null;
};

const ensureAnonymousId = () => {
  const existing = readCookie(ANON_COOKIE);
  if (existing) return existing;
  const fresh = generateUuid();
  setCookie(ANON_COOKIE, fresh, COOKIE_TTL_DAYS);
  return fresh;
};

export default function CookieBanner() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showCustomise, setShowCustomise] = useState(false);
  const [selections, setSelections] = useState(() => ({
    essential: true,
    preferences: false,
    analytics: false,
    marketing: false,
  }));

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setOpen(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed?.policyVersion !== POLICY_VERSION) {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  const persistAndSend = async (categories) => {
    const anonymousId = ensureAnonymousId();
    const payload = {
      categories,
      policyVersion: POLICY_VERSION,
      anonymousId,
      capturedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // best effort; banner will reappear next session if storage is blocked
    }
    try {
      await fetch("/api/cookies/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          anonymousId,
          categories,
          policyVersion: POLICY_VERSION,
        }),
      });
    } catch {
      // server-side mirror is best-effort; the local choice still applies
    }
    setOpen(false);
  };

  const acceptAll = () => {
    persistAndSend({
      essential: true,
      preferences: true,
      analytics: true,
      marketing: true,
    });
  };

  const rejectAll = () => {
    persistAndSend({
      essential: true,
      preferences: false,
      analytics: false,
      marketing: false,
    });
  };

  const saveCustom = () => {
    persistAndSend({ ...selections, essential: true });
  };

  const containerStyle = useMemo(
    () => ({
      position: "fixed",
      left: 16,
      right: 16,
      bottom: 16,
      zIndex: 1500,
      maxWidth: 720,
      margin: "0 auto",
      // Surface, padding, radius and (no) border all flow from the
      // .app-section-card token system declared in globals.css.
      color: "var(--text-primary)",
      fontFamily: "var(--font-family, system-ui, sans-serif)",
    }),
    []
  );

  // Solid-accent (Accept All): brand colour on accent text. Fine in both
  // modes because --onAccentText is already light-/dark-aware.
  const buttonPrimary = {
    minHeight: 40,
    padding: "10px 14px",
    border: "none",
    borderRadius: "var(--radius-xs, 6px)",
    fontWeight: 600,
    cursor: "pointer",
    background: "var(--accentMain)",
    color: "var(--onAccentText)",
  };

  // Ghost (Customise, Reject All, Save Choices): no border, transparent
  // surface, and text follows --text-primary so it flips with light/dark.
  const buttonGhost = {
    minHeight: 40,
    padding: "10px 14px",
    border: "none",
    borderRadius: "var(--radius-xs, 6px)",
    fontWeight: 600,
    cursor: "pointer",
    background: "transparent",
    color: "var(--text-primary)",
  };

  if (!mounted || !open) return null;

  return (
    <div role="dialog" aria-label="Cookie consent" className="app-section-card" style={containerStyle}>
      <h2 style={{ margin: "0 0 6px", fontSize: "1.05rem" }}>Cookies on this site</h2>
      <p style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        We use essential cookies to make the site work. With your permission we&apos;d
        also like to use other cookies to remember preferences, measure usage, and improve
        the service. You can change your choice at any time on the privacy page.
      </p>

      {showCustomise && (
        <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
          {CATEGORIES.map((cat) => (
            <label
              key={cat.key}
              className="app-section-card"
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 10,
                alignItems: "start",
                cursor: cat.locked ? "default" : "pointer",
                opacity: cat.locked ? 0.85 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={cat.locked ? true : Boolean(selections[cat.key])}
                disabled={cat.locked}
                onChange={(e) =>
                  setSelections((prev) => ({ ...prev, [cat.key]: e.target.checked }))
                }
                style={{ marginTop: 4 }}
              />
              <span>
                <span style={{ display: "block", fontWeight: 600 }}>
                  {cat.label}
                  {cat.locked && (
                    <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      (always on)
                    </span>
                  )}
                </span>
                <span style={{ display: "block", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                  {cat.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "flex-end",
        }}
      >
        {!showCustomise && (
          <button type="button" onClick={() => setShowCustomise(true)} style={buttonGhost}>
            Customise
          </button>
        )}
        {showCustomise && (
          <button type="button" onClick={saveCustom} style={buttonGhost}>
            Save Choices
          </button>
        )}
        <button type="button" onClick={rejectAll} style={buttonGhost}>
          Reject All
        </button>
        <button type="button" onClick={acceptAll} style={buttonPrimary}>
          Accept All
        </button>
      </div>
    </div>
  );
}
