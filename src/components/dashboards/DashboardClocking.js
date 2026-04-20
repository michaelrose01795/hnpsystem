// file location: src/components/dashboards/DashboardClocking.js
// ⚠️ DEPRECATED — orphan dashboard widget (no importers as of 2026-04-10).
//
// This component renders a grid of technicians with their current clocking
// status. It is not mounted on any current dashboard; the live workshop
// clocking surfaces are `src/components/Clocking/ClockingList.js` and
// `src/components/Clocking/EfficiencyTab.js`.
//
// Why it stayed broken: the previous version imported
// `@/components/context/ClockingContext` (a path that does not exist) — the
// real provider lives at `@/context/ClockingContext`. Because nothing imports
// this file, the broken path never showed up at build time. Fixed here so
// the file is at least valid JavaScript if someone wires it back in.
//
// Other corrections vs the previous version:
//   - Fixed the `// file location:` comment (was missing the `dashboards/` segment).
//   - Replaced hardcoded color literals on the cards with theme tokens that
//     match the rest of the codebase. The status pill is now driven by the
//     `--success` / `--danger` semantic tokens (per CLAUDE.md these are the
//     allowed status families).
//   - Defensive: filter ignores users with no `roles` array.
import React, { useEffect, useState } from "react";
import { useClockingContext } from "@/context/ClockingContext"; // canonical clocking source
import { SectionGridSkeleton } from "@/components/ui/LoadingSkeleton";

export default function DashboardClocking() {
  // Pull the all-users clocking snapshot from the provider.
  const { allUsersClocking, fetchAllUsersClocking, loading } = useClockingContext();
  const [techs, setTechs] = useState([]); // filtered list of technician users

  // Trigger an initial fetch of the cross-user snapshot when the widget mounts.
  useEffect(() => {
    fetchAllUsersClocking();
  }, [fetchAllUsersClocking]);

  // Re-derive the technician list whenever the upstream snapshot changes.
  useEffect(() => {
    // Defensive: some users may not have a roles array yet — skip them safely.
    const techUsers = (allUsersClocking || []).filter((u) => Array.isArray(u?.roles) && u.roles.includes("Techs"));
    setTechs(techUsers);
  }, [allUsersClocking]);

  // Provider is still loading the snapshot — show a structured grid skeleton
  // that matches the final 3-column technician card layout.
  if (loading)
    return (
      <div style={{ marginTop: "var(--space-4)" }}>
        <SectionGridSkeleton cards={6} cols="repeat(3, 1fr)" rows={2} />
      </div>
    );

  return (
    <div style={{ marginTop: "var(--space-4)" }}>
      {/* Section title — uses the global text token, not a hardcoded color. */}
      <h2 style={{ color: "var(--text-primary)", marginBottom: "var(--space-3)" }}>
        Workshop Clocking Overview
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--space-4)",
        }}
      >
        {techs.map((tech) => (
          <div
            // Prefer a stable id over array index — falls back to user name.
            key={tech.userId || tech.id || tech.user}
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-xs)",
              padding: "var(--space-4)",
              textAlign: "center",
              minHeight: "100px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              fontWeight: 500,
              fontSize: "1rem",
              color: "var(--text-primary)",
            }}
          >
            {/* Technician display name as returned by /api/profile/clock */}
            <div>{tech.user}</div>
            <div
              style={{
                marginTop: "var(--space-2)",
                // Status colour comes from the semantic status tokens.
                color: tech.clockedIn ? "var(--success)" : "var(--danger)",
              }}
            >
              Status: {tech.clockedIn ? "Clocked In" : "Clocked Out"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
