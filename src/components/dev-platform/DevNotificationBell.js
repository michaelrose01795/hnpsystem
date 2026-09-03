// file location: src/components/dev-platform/DevNotificationBell.js
//
// Phase 10 — the topbar notification bell for the Developer Platform. Shows the
// live unread count (streamed via useNotifications) and a dropdown of recent
// notifications with per-item + mark-all read. CLAUDE.md: the dropdown is a
// <LayerSurface> (borderless), the bell + rows are 44px targets, severity is a
// tinted background + icon (not a coloured border).

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LayerSurface from "@/components/ui/LayerSurface";
import useNotifications from "@/components/dev-platform/useNotifications";
import { toneTint } from "@/components/support/dev/supportDevUi";

const SEVERITY_TONE = { info: "text-1", success: "success-base", warning: "warning-base", critical: "danger-base" };

export default function DevNotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="app-btn app-btn--ghost"
        style={{ position: "relative", minWidth: 44 }}
      >
        <span>Alerts</span>
        {unread > 0 && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              background: "var(--danger-base)",
              color: "#fff",
              fontSize: "11px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <LayerSurface
          role="dialog"
          aria-label="Notifications"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: "var(--z-dropdown)",
            width: "min(360px, 92vw)",
            maxHeight: "70vh",
            gap: "var(--space-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)" }}>
            <strong style={{ color: "var(--accentText)", fontSize: "var(--text-body)" }}>Notifications</strong>
            <div style={{ display: "flex", gap: "6px" }}>
              {unread > 0 && (
                <button type="button" onClick={markAllRead} className="app-btn app-btn--ghost app-btn--xs">
                  Mark all read
                </button>
              )}
              <Link href="/dev/notifications" onClick={() => setOpen(false)} className="app-btn app-btn--secondary app-btn--xs">
                Settings
              </Link>
            </div>
          </div>

          <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
            {items.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.7 }}>
                You&rsquo;re all caught up.
              </div>
            ) : (
              items.slice(0, 20).map((n) => {
                const tone = SEVERITY_TONE[n.severity] || "text-1";
                const body = (
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      padding: "8px 10px",
                      borderRadius: "var(--radius-md)",
                      background: n.read_at ? "transparent" : toneTint(tone, 12),
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: "var(--text-body-sm)", fontWeight: n.read_at ? 500 : 700, color: "var(--text-1)" }}>{n.title}</div>
                      {n.body ? <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.7 }}>{n.body}</div> : null}
                    </div>
                    {!n.read_at && (
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); markRead(n.id); }} title="Mark read" aria-label="Mark read" className="app-btn app-btn--ghost app-btn--xs" style={{ alignSelf: "flex-start" }}>
                        Read
                      </button>
                    )}
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => { setOpen(false); if (!n.read_at) markRead(n.id); }} style={{ textDecoration: "none" }}>
                    {body}
                  </Link>
                ) : (
                  <div key={n.id}>{body}</div>
                );
              })
            )}
          </div>
        </LayerSurface>
      )}
    </div>
  );
}
