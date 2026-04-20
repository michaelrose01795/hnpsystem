// file location: src/components/Clocking/ClockingCard.js
// ⚠️ DEPRECATED — orphan component (no importers as of 2026-04-10).
//
// This card is the original "personal clocking widget" UI. It is not mounted
// on any current page; the live workshop clocking entry point is
// `src/components/Workshop/JobClockingCard.js`. The file is kept and made
// theme-correct so it can be reused by future personal-dashboard work without
// inheriting bugs.
//
// Changes vs the previous version:
//   - Consumes `useClockingContext` directly. (The legacy `useClocking`
//     adapter hook was deleted on 2026-04-10 — see git history.)
//   - Fixed latent crash: `hoursWorked.toFixed(2)` was called on a string in
//     the old hook return shape. The context returns a Number, and we
//     defensively coerce in case the provider is mid-fetch.
//   - Replaced hardcoded `var(--danger)` / `var(--success)` color overrides
//     on the Button with the shared `Button` variants. Per CLAUDE.md the
//     theme tokens and `.app-btn` system are the source of truth; status
//     colors should not be inlined on a button style prop.
import React from "react";
import { useClockingContext } from "@/context/ClockingContext"; // canonical clocking source
import { Button, Card } from "@/components/ui";
import { SectionSkeleton } from "@/components/ui/LoadingSkeleton";

export default function ClockingCard() {
  // Pull state + actions straight from the provider — no legacy hook layer.
  const { clockedIn, hoursWorked, loading, clockIn, clockOut } = useClockingContext();

  // Provider is still resolving the user's status — show a structured skeleton
  // that matches the real card shape (title + status lines + action button).
  if (loading)
    return (
      <SectionSkeleton
        titleWidth="180px"
        subtitleWidth="140px"
        rows={2}
        style={{ width: "100%", maxWidth: "32rem" }}
      />
    );

  // Defensive numeric coercion: hoursWorked should be a Number, but during
  // first render or after an error it can be undefined. Default to 0.
  const hoursDisplay = Number(hoursWorked || 0).toFixed(2);

  return (
    <Card
      title="Your Clocking Status"
      style={{ width: "100%", maxWidth: "32rem" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {/* Human-readable status line for the logged-in user */}
        <p>Status: {clockedIn ? "Clocked In" : "Clocked Out"}</p>
        {/* Total hours since most recent clock-in (0 if clocked out) */}
        <p>Hours Worked Today: {hoursDisplay}</p>
      </div>
      {clockedIn ? (
        // Use the shared secondary variant — theme tokens drive the color.
        // Avoid inlining --danger here so accent themes stay in control.
        <Button
          onClick={clockOut}
          variant="secondary"
          style={{ alignSelf: "flex-start" }}
        >
          Clock Out
        </Button>
      ) : (
        // Same reasoning for the clock-in button — defer to global theme.
        <Button
          onClick={clockIn}
          variant="primary"
          style={{ alignSelf: "flex-start" }}
        >
          Clock In
        </Button>
      )}
    </Card>
  );
}
