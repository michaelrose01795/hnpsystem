# Phase 2 — Toast Styling + Accessibility (Progress)

**Part of** the [Frontend Feedback & Error System rollout](frontend-feedback-system-rollout.md) · follows [Phase 1 audit](frontend-feedback-audit-phase1.md).
**Goal (from rollout §Phase 2):** make the existing top-right toast design-system compliant and accessible — **no behaviour change**, styling moved out of inline styles and into `staffglobal.css`, with live-region announcements, tone icons, keyboard dismiss, hover/focus pause, and reduced-motion support.
**Status:** ✅ Implemented.
**Last updated:** 2026-07-03.

---

## 1. What Phase 2 changed

### 1.1 Styling moved to `staffglobal.css`
- All toast styling that previously lived as inline `style={{…}}` objects in `TopbarAlerts.js` now lives in a single token-driven block in `src/styles/staffglobal.css`.
- The floating container is the new **`.app-toast-stack`** class; each toast reuses the **shared `.app-alert`** surface (borderless, tone-tinted) with stack-only affordances layered on via `.app-toast-stack .app-alert`.
- The stack is positioned with `--z-toast` and `--page-gutter-y` (matching the previous inline offset), sized responsively (`min(400px, calc(100vw − 48px))`), and is **click-through in the gaps** (`pointer-events: none` on the stack, `auto` on each toast).
- No inline surface `background` / `border` / `borderRadius` remain on the toast surfaces — the toast obeys the **Border Sweep** and **Layer Sweep** laws (tone is signalled by surface tint + icon colour, not a coloured side-border).

### 1.2 Accessibility
- **Single persistent live region** — a visually-hidden `.app-toast-stack__live` node (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`) is **always mounted** (the container renders even with zero alerts) and announces the newest alert, prefixed with its tone label (e.g. *"Error: …"*) so the tone reaches screen-reader users without relying on colour. The visible toasts no longer each carry `role="alert"`, so there is no double-announcement.
- **Tone icons (not colour-only)** — each toast shows a glyph in a tinted circle (`✓` success, `!` warning/error, `i` info) via `.app-alert__icon`, so tone is conveyed by shape + colour.
- **Keyboard dismiss** — each toast is focusable (`tabIndex=0`); **Esc** dismisses, and **Enter/Space** dismiss when the toast root itself is focused (nested Copy/Dismiss buttons keep their own Enter/Space behaviour). The `✕` dismiss and the Copy-for-Dev button are real `<button>`s with visible `--focus-ring` focus states and `aria-label`s.
- **Hover/focus pause** — auto-dismiss now pauses while a toast is hovered **or** keyboard-focused, and resumes (from the remaining time, not a fresh 5s) when both are released. See §1.3 for where the timer moved.
- **Reduced motion** — the entrance animation (`@keyframes app-toast-in`) is disabled under `@media (prefers-reduced-motion: reduce)`.
- **Explicit tone handling** — tone is driven by the alert's explicit `type` (`success` / `error` / `warning` / `info`) mapped to a CSS modifier + icon + SR label in one `TOAST_TONES` table. The brittle emoji/string inference in `alertBus.js` was **left untouched** (that is Phase 3's job); Phase 2 only consumes `type` where it is already available.

### 1.3 Auto-dismiss timer moved (confirmed global-context touch)
- To make hover/focus pause genuine, the auto-dismiss timer was **moved out of `AlertContext`** (which cannot be paused from the renderer) and into `TopbarAlerts`.
- `AlertContext` is now purely the alert store — it appends on emit and removes by id. `TopbarAlerts` owns a per-alert timer map with **remaining-time tracking** (pause banks elapsed time; resume continues from the remainder) and reconciles timers against the live alert list, so alerts beyond the visible three are still dismissed (no accumulation) and there is **no observable behaviour change** (still ~5s auto-close).
- This edit to `src/context/AlertContext.js` is a **CLAUDE.md §7 global-context change** and was **explicitly approved** before implementation (chosen over a scope-limited best-effort pause).

---

## 2. Files touched

| File | Change |
|---|---|
| `src/components/TopbarAlerts.js` | Rewrote the toast stack onto `.app-toast-stack` / `.app-alert` classes; added the `ToastItem` sub-component (keyboard dismiss, hover/focus pause handlers), the persistent live region, tone icons, and the parent-owned pausable auto-dismiss timer map. `AlertBadge` (unused legacy export) left functionally unchanged. |
| `src/styles/staffglobal.css` | Added the token-driven toast block: `.app-toast-stack`, `.app-toast-stack__live`, `.app-toast-stack .app-alert`, `.app-alert--info`, `.app-alert__main` / `__icon` / `__message` / `__dismiss` / `__dev` / `__dev-label` / `__copy-btn`, the `app-toast-in` keyframe, the reduced-motion override, and a mobile media query. |
| `src/context/AlertContext.js` | Removed the auto-close `setTimeout` (moved to `TopbarAlerts`); the effect now only appends alerts. **(§7 global-context change — approved.)** |
| `docs/frontend-feedback-phase2-toast-a11y.md` | This progress note (new). |

**Files reviewed (not changed):** `src/lib/notifications/alertBus.js`, `src/styles/families/toasts.css`, `src/styles/theme.css` (token verification), `src/components/layout/StaffLayout.js` (mount point), `src/pages/_app.js` (provider tree + `staff-scope` toggle), all `useAlerts` consumers (confirmed all others only emit via `pushAlert`).

**DB schema checked?** No — this phase is presentation/UX only; no data access involved.

**Scope:** Local to the toast surface **plus one approved global-context edit** (`AlertContext.js`). No shared card/layout/theme-token files were modified.

---

## 3. What was tested

- ✅ `npm run check:borders` — passes (no forbidden `border:` declarations; toast tone is tint + icon only).
- ✅ `npx eslint src/components/TopbarAlerts.js src/context/AlertContext.js` — clean, no warnings/errors.
- ✅ Token audit — every token referenced by the new CSS (`--z-toast`, `--page-gutter-y`, `--page-gutter-y-mobile`, `--space-*`, `--text-body-sm`, `--text-caption`, `--radius-pill`, `--radius-md`, `--focus-ring`, `--ghostbutton-ring`, `--secondary`, and the `--success/--warning/--danger` surface/strong pairs) confirmed present in `theme.css`.
- ✅ Consumer audit — only `TopbarAlerts` reads `alerts`/`dismissAlert`; every other `useAlerts` caller only emits, so moving the timer is safe.

**Not yet done (recommend before Phase 2 sign-off):**
- [ ] Manual/AT smoke: trigger each tone from `/dev/user-diagnostic#toast`, confirm VoiceOver/NVDA announces the tone-prefixed message once, Tab reaches each toast, Esc/Enter/Space dismiss, hover/focus visibly pauses auto-close, and reduced-motion removes the slide-in.
- [ ] **WCAG AA contrast** verification of the tone surface/text pairs in both light and dark themes — this is a Phase 1 exit gate ("confirm tone-token WCAG AA contrast before P2 exit") and is a token concern, not a `TopbarAlerts` change.

---

## 4. What should be done next (no later-phase work started here)

- **Phase 2 exit gates still open:** the AT smoke test and the tone-token WCAG AA contrast check above.
- **Phase 3 (next):** the message catalogue + `reportError`/`reportSuccess` helper layer, and downgrading `deriveTypeFromMessage` in `alertBus.js` to a fallback so callers pass explicit `type`. Phase 2 deliberately did **not** touch `alertBus.js`.
- **Phase 4:** role-gate the "Copy for Dev" / `Dev info available` row (currently still shown to all users — the sharpest single audit finding). The dev row markup was kept intact so Phase 4 only needs to wrap it in a role check.
- **Known consideration (documented, not a regression):** `AlertProvider` is app-wide but `TopbarAlerts` mounts only inside `StaffLayout`; on non-staff routes (customer/website) there is no toast renderer, so emitted alerts are neither shown nor timed there — same as before (they were never visible), but they no longer auto-clear from context state on those routes. Revisit if/when Phase 9 extends a report path to those surfaces.

---

*Phase 2 only. Later phases (P3–P10) were not started or modified. Any later-phase work must re-run the CLAUDE.md pre-flight and stop-and-confirm on global changes.*
