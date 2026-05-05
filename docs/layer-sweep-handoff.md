# Layer Sweep — Finishing Handoff

**Purpose:** Paste the prompt block below into a fresh Claude Code chat to finish the last tail of the layer sweep. The bulk of the work is done; what remains is migrating ~15 residual files and deleting deprecated token aliases.

**Status when this handoff was written (2026-05-05):** Phases 1 and 2 mostly complete. `<LayerSurface>` and `<LayerTheme>` exist, `Card` / `Section` route through `<LayerSurface>`, theme.css aliases are in place, the layer guard at `tools/scripts/check-layers.js` runs and passes. Remaining work: 15 files still use legacy surface tokens and are listed in the guard's `RESIDUAL_TOKEN_ALLOWLIST`. Until they migrate, the deprecated tokens cannot be deleted.

---

## Paste this into the new chat

````
I'm finishing the last tail of the layer sweep. All context is in docs/layer-sweep-handoff.md — read that first, then read CLAUDE.md section 3 (Design System), src/components/ui/LayerSurface.js, src/components/ui/LayerTheme.js, and tools/scripts/check-layers.js.

After reading, confirm back to me in 3–4 bullet points:
1. The 15 files you will migrate
2. The alternation rule you will apply
3. Which file you are handling specially (Sidebar) and why
4. Anything ambiguous that needs my input before you start

Do NOT begin editing until I reply "go". Work in small batches and commit per batch.
````

---

## The three steps

### Step A — Migrate the 15 residual files

Each of these files currently uses an inline `style={{ background: 'var(--section-card-bg)' ... }}` (or `--page-card-bg`, `--surfaceMain`, `--row-background`, `--section-card-border`, etc.) on a card / section / panel `<div>`. Replace that wrapper with `<LayerSurface>` or `<LayerTheme>` honouring strict alternation with whatever wraps it.

```
src/pages/clocking/index.js
src/components/HR/HrTabLoadingSkeleton.js
src/components/HR/StaffVehiclesCard.js
src/components/page-ui/appointments/appointments-ui.js
src/components/page-ui/workshop/workshop-consumables-tracker-ui.js
src/components/profile/ProfileWorkTab.js
src/components/Sidebar.js
src/components/StatusTracking/JobProgressTracker.js
src/components/VHC/BrakesHubsDetailsModal.js
src/components/VHC/ExternalDetailsModal.js
src/components/VHC/InternalElectricsDetailsModal.js
src/components/VHC/ServiceIndicatorDetailsModal.js
src/components/VHC/UndersideDetailsModal.js
src/components/VHC/VhcCustomerDescriptionModal.js
src/components/VHC/WheelsTyresDetailsModal.js
```

Rules:
- Strict alternation: outermost is `<LayerSurface>`, next nested layer is `<LayerTheme>`, next `<LayerSurface>`, etc. Two of the same in a row is a bug.
- Both layer components are borderless. Do not add `border:` back via inline style on any card / section.
- Inline styles for non-surface concerns (flex, gap, text colour, width, height) stay as they are. Do not touch business logic.
- The 7 VHC modals are likely near-identical structure — read one, agree the pattern with me, then apply it across the others.

**Sidebar is the risky one** — it is listed as a global file in CLAUDE.md section 7. Do it last and **stop and confirm with me before editing it**. It may use a surface token in a non-card context (e.g. nav row hover) where the right fix is a different token, not `<LayerSurface>`. If so, flag it.

Suggested batches:
1. VHC modals (7 files) — single commit
2. HR + profile + StatusTracking + page-ui (6 files) — single commit
3. clocking page (1 file) — single commit
4. Sidebar (1 file) — stop and confirm first, then single commit

Commit message format: `layer-sweep: migrate <batch name>`.

### Step B — Tighten the guard as you go

After each batch, **delete the migrated filenames from the `RESIDUAL_TOKEN_ALLOWLIST` set in `tools/scripts/check-layers.js`** and run `node tools/scripts/check-layers.js`. It must still pass. If it doesn't, the migration of that file is incomplete — fix before moving on.

When the allowlist is empty, delete the `RESIDUAL_TOKEN_ALLOWLIST` constant and the conditional that uses it from the guard entirely. Re-run the guard to confirm it still passes.

### Step C — Delete the deprecated token aliases

Once the allowlist is empty and the guard passes:

1. Grep the entire codebase for each deprecated token to confirm zero references remain:
   - `--surfaceMain`
   - `--section-card-bg`
   - `--page-card-bg`
   - `--row-background`
   - `--section-card-border`
   - `--page-card-border`
   - `--section-card-radius`
   - `--page-card-radius`

2. For any token with zero references, delete its declaration from `src/styles/theme.css` — both the light block (around lines 30–220) and the dark block (around lines 415–611).

3. Run the guard one more time. Run the dev server and visually spot-check the previously-allowlisted pages (clocking, HR tabs, appointments, VHC modals, Sidebar) to make sure nothing renders blank or unstyled.

4. Commit: `layer-sweep: remove deprecated surface token aliases`.

---

## Things that must NOT happen

- Do not change `src/pages/dev/user-diagnostic.js` showcase section — it is the canonical visual reference.
- Do not edit `src/components/Layout.js` or globally restructure `src/components/Sidebar.js` without flagging first (CLAUDE.md section 7).
- Do not introduce new tokens.
- Do not refactor surrounding logic while doing surface migration. Surface only.
- Do not delete a token from `theme.css` without grepping first to confirm zero references.
- Do not bypass the guard by adding files back to the allowlist — the goal is to empty it.

---

**End of handoff.**
