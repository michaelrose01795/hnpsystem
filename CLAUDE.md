# CLAUDE.md — Master Rules for HNPSystem

**Read this file in full before touching any code.**
This is the single source of truth for all UI, layout, file structure, database, and edit discipline rules.
It applies to every prompt, every session, every agent.

---

## 1. Project Identity

- **App:** HNPSystem — Dealer Management System for Humphries & Parks
- **Stack:** Next.js (Pages Router), React, Supabase (PostgreSQL), NextAuth.js, plain CSS with CSS custom properties. **There is no Tailwind build** - `tailwindcss` is in `package.json` but there is no config, no PostCSS pipeline and no `@tailwind` directive anywhere, so utility classes silently do not compile. Do not write them.
- **Auth:** NextAuth.js with Credentials Provider → Supabase users table. Keycloak env vars exist but are not yet active.
- **Roles:** Defined in `src/lib/auth/roles.js` and `src/config/users.js`. Role checks use `hasAnyRole`, `isHrCoreRole`, `isAdminManagerRole`, etc. Never hardcode role strings — import from those files.
- **Database:** Supabase client at `src/lib/database/supabaseClient.js`. All DB operations live under `src/lib/database/`. Never query Supabase directly in page or component files.
- **Path alias:** `@/` maps to `src/`. Always use it.

---

## 2. Before Every Task — Mandatory Pre-Flight

Before writing or changing any code:

1. **Read this file** (CLAUDE.md) — you are doing that now.
2. **Understand the request** — state in one sentence what the user is asking for.
3. **Inspect relevant files** — read the page file, tab file, or section file the change belongs to. Read related components, hooks, lib files, types, and DB helpers.
4. **Check for existing patterns** — search for the UI component, hook, or utility before creating a new one.
5. **Check the DB schema** — before any data-related change, read `src/lib/database/schema/schemaReference.sql` and the relevant DB helper file under `src/lib/database/`. Never guess column names, relationships, or status values.
6. **Assess scope** — decide if the change is local (one page/component) or global (shared component, style token, layout). If global, **stop and flag it** before proceeding.

---

## 3. Design System — Non-Negotiable

### 3.0a Borders — THE LAW (Border Sweep, 2026-05-07)

**Borders are banned everywhere except five specific use-cases.** Each has its own token; the word "border" is reserved for things that aren't decorative outlines.

| Use-case | Token | Notes |
|---|---|---|
| Row-bottom rule inside tables / lists | `--separating-line` | The ONLY allowed "line within a list". Never apply to the outer table edge — only to row separators (`border-bottom` on `tr`/`td`). |
| Form inputs (text / select / textarea) | `--input-ring` | Replaces the deprecated `--input-border` / `--control-border`. |
| Checkboxes & radios | `--checkbox-ring` | Used by `input[type="checkbox"]`, `input[type="radio"]`, `.app-toggle--checkbox`, `.app-toggle--radio`. |
| Ghost buttons | `--ghostbutton-ring` | Used by `.app-btn--ghost`. No other button variant carries an outline. |
| Keyboard focus | `--focus-ring` | Applied via `box-shadow`, not `border`. Supersedes ad-hoc `--control-ring` usage. |

**Banned tokens (resolve to `transparent` / `none` and will be deleted):**
`--primary-border`, `--secondary-border`, `--section-card-border`, `--page-card-border`, `--nav-shell-border`, `--nav-link-border`, `--nav-link-border-active`, `--profile-card-border`, `--calendar-today-row-border`, `--hud-border`, `--hud-border-strong`, `--skeleton-border`, `--control-border`. Do not introduce new references — they're aliases for `transparent` / `none` so legacy declarations render no visible outline.

**Rules:**
1. Outside the five use-cases above, **never** write `border: …` on a card, section, panel, nav link, toolbar, toast, calendar cell, badge, or chip — neither in CSS nor inline.
2. The word **border** in token names is reserved for the legacy/banned set. New outline tokens use **ring** (or `--separating-line` for table row rules).
3. Toasts, calendar today-rows, and similar variant signalling now rely on background tint + icon colour, not coloured side-borders.
4. `border-radius`, `border-collapse`, `border-spacing`, `box-sizing: border-box`, and transparent placeholder borders for layout (e.g. `border: 1px solid transparent` to prevent hover-shift) are **not** affected by this rule.

**Ring tokens come in PAIRS — the two halves are not interchangeable.** Each ring use-case has a bare colour and a complete shorthand:

| Want | Write |
|---|---|
| the standard ring | `border: var(--input-ring)` |
| your own width / style | `border: 2px dashed var(--input-ring-color)` |

`border: 1px solid var(--input-ring)` expands to `1px solid 1px solid rgba(…)`, which is invalid CSS. The browser drops the whole declaration and the control renders with **no ring at all** — silently, and invisibly in review, because the token name looks right. The same applies to `--checkbox-ring(-color)`, `--ghostbutton-ring(-color)` and `--separating-line(-color)`. `--focus-ring` / `--control-ring` are `box-shadow` values and are never valid as a border colour; use `--input-ring-focus-color` for a focused input's border. `npm run check:borders` fails the build on all of these.

**Enforcement:** `npm run check:borders` ([tools/scripts/check-borders.js](tools/scripts/check-borders.js)) scans `src/` for forbidden `border: …` declarations and for the ring misuse above, and exits non-zero on violations. Run it before committing any UI change. Functional diagram primitives (TyreDiagram, BrakeDiagram, photo/video editors, LoadingSkeleton, email templates) are allowlisted inside the script.

### 3.0a-2 The surface ladder — THE LAW (Colour Audit, 2026-08)

In a borderless system the **colour step between two surfaces is the only thing separating them**, so those steps are load-bearing and are enforced.

```
app shell (--page-shell-bg, opaque accent/surface blend)
  page card      --surface        .app-page-card,   <LayerSurface>
    section card --theme          .app-section-card, <LayerTheme>
      nested     --surface        flips back — never stack --theme on --theme
```

- `--section-card-bg` resolves to **`--theme`**, not `--surface`. It is *not* an alias of `--page-card-bg`; the two rungs must differ. The flip-back for nested surfaces lives in [families/cards.css](src/styles/families/cards.css).
- **Controls are part of the ladder.** A control on a `--theme` layer takes the `--surface` fill, because no single accent-alpha fill separates from both a white card and a tint. This is done by re-binding `--primary-control-*` on theme-layer containers — the whole control family (buttons, inputs, dropdown triggers, calendar, time picker) follows automatically. Never hand-roll a per-component background to work around it.
- **Light and dark use different alphas on purpose.** The same alpha over white gives roughly *half* the perceptual step it gives over near-black. Light is `--secondary` .14 / `--theme` .16; dark is .16 / .18. Making the numbers match un-matches the look — that is exactly how light mode went flat.
- The **low-chroma accents (Stone, Slate) are the binding constraint** in light mode, not the default red. An alpha that looks fine on red can fail on those.

**Enforcement:** `npm run check:colours` ([tools/scripts/check-colour-system.js](tools/scripts/check-colour-system.js)) resolves the real token values through `themeRuntime.js`, composites every translucent layer, and asserts a perceptual-lightness floor (CIE ΔL* ≥ 6 for a surface step, ≥ 3.5 for a hover step) plus WCAG 4.5:1 on every text-on-fill pairing — for **all 9 accents × both modes**. Runs in `predev`/`prebuild`. `npm run review:colours` renders the same matrix to screenshots in `e2e/.colour-review/` for a visual pass.

**Token sources must stay in step.** Colour is derived in one place — `buildThemeTokens()` in [src/styles/themeRuntime.js](src/styles/themeRuntime.js) — and consumed twice: by the React provider after hydration, and by the first-paint script in `_document.js`, which serialises the *same function* with `.toString()`. That function must stay self-contained (it closes over nothing) or the first paint breaks. The static `:root` blocks in `theme.css` are the no-JS fallback and must mirror it.

### 3.0b Design Governance — canonical sources & drift control

Full detail: [docs/ui/staff-design-governance.md](docs/ui/staff-design-governance.md).
Enforced by `npm run check:design` (runs in `predev` and `prebuild`).

**Canonical sources.** These existing files are the design system. Nothing
else may define staff UI appearance:

| Concern | Canonical source |
|---|---|
| Design tokens | `src/styles/theme.css` |
| Staff global stylesheet | `src/styles/staffglobal.css` |
| Shared UI families | `src/styles/families/*.css` (entry `families/index.css`) |
| Family registry | `src/components/ui/variants.js` (`UI_FAMILIES`) |
| Customer design system | `src/styles/custglobal.css` (`/website` only) |

**Rules for new work.** These apply to new code and do not require touching
existing pages:

1. Use a shared component (`Button`, `DropdownField`, `InputField`,
   `TabGroup`, `LayerSurface`/`LayerTheme`, `EmptyState`, `PopupModal`).
   Failing that, the canonical class of a family registered in `variants.js`.
2. If a family lacks the variant you need, add it to the family file **and**
   register it in `variants.js`. Never style it locally.
3. **No one-off inline visual styling.** `style={{ background, color,
   padding, border, borderRadius, boxShadow, font*, letterSpacing,
   textTransform }}` is blocked on new/changed files. Layout-only inline
   styles (`display`, `flex`, `gap`, `grid`, `width`, `position`, …) are fine.
4. No raw hex colours. No `var()` pointing at a token that is not defined.
5. No new `!important`.
6. `/website` and `custglobal.css` stay isolated — staff CSS must never style
   `html.website-scope`, and vice versa. This is a hard check.

**Baselined debt.** `tools/design-baselines/design-governance.json` records
the existing violations per file: family classes declared outside their
family file (196), `!important` (462), undefined token references (0), raw
hex colours (63), one-off inline styling (11,843). **A file with no baseline
entry is held to zero**, so new drift fails the build while existing files
keep exactly the styling they have. Counts may only fall.

**Do not "fix" baselined debt as a side effect of unrelated work.** The
current staff UI is the visual reference, legacy styling included. Correcting
a duplicate, an undefined token or a one-off style changes what a page
renders and belongs in a deliberate migration with its own visual review.
Known competing implementations (three tab systems, `.app-toast` vs
`.app-alert`, the duplicated `.app-empty-state` rules, the missing desktop
heading hierarchy and form-label primitive) are catalogued in the governance
doc — recorded on purpose, not yet consolidated.

### 3.0 Layer Primitives — THE LAW (post-Layer-Sweep, 2026-05-05)

**Only two surface primitives exist for the entire app:**

| Component | Background | Where |
|---|---|---|
| `<LayerSurface>` | `var(--surface)` | `src/components/ui/LayerSurface.js` |
| `<LayerTheme>` | `var(--theme)` | `src/components/ui/LayerTheme.js` |

**Rules:**
1. Every card / section / panel / surface in the app MUST be one of these two components (or a wrapper that renders one of them, e.g. `<Card>`, `<Section>`, `<SectionCard>` — all of which now route through `<LayerSurface>` internally).
2. **Strict alternation as you nest deeper:**
   `<LayerSurface>` → `<LayerTheme>` → `<LayerSurface>` → `<LayerTheme>` ...
   The outermost surface is `<LayerSurface>`; every nested surface flips. Two consecutive `<LayerSurface>` (or two consecutive `<LayerTheme>`) is a bug.
3. **Both layer components are borderless.** `<LayerSurface>` and `<LayerTheme>` render with **no border** — period.
4. **Banned inline styles on cards / sections:**
   ```
   ❌ <div style={{ border: ... }}>           // banned on cards/sections
   ❌ <div style={{ background: ... }}>       // banned on cards/sections
   ❌ <div style={{ borderRadius: ... }}>     // banned on cards/sections
   ```
   Use `<LayerSurface>` / `<LayerTheme>` and pass `radius`, `padding`, `gap` props if you need to override the defaults. Inline styles for non-surface concerns (flex, gap, colour for text, height, width, etc.) remain fine.
5. **Borders ARE still allowed on non-surfaces:** buttons, inputs, badges, table rows used to indicate state (selected / error), separators. The ban is **surfaces only** — anything that looks like a card or panel.
6. **Visual reference:** "Section Layers (surface / theme alternation)" showcase in [src/pages/dev/user-diagnostic.js](src/pages/dev/user-diagnostic.js) lines 2860–2880 — but rendered without the borders shown there.

### 3.1 Token Sources
- **Colour tokens:** `src/styles/theme.css` — CSS custom properties only (e.g. `var(--accentText)`, `var(--surface)`, `var(--theme)`, `var(--text-1)`)
- **Base layout classes:** `src/styles/staffglobal.css` — `.app-page-shell`, `.app-page-stack`, `.app-section-card`, `.app-page-card`
- **Shared UI families:** `src/styles/families/*.css`, imported through `families/index.css` at the top of `staffglobal.css`. Registered in `src/components/ui/variants.js`.
- **Customer design system:** `src/styles/custglobal.css` — `/website` only, gated by `html.website-scope`. Completely separate; never mix the two.
- There is no `src/styles/globals.css`. Older docs referring to it mean `staffglobal.css`.
- **Never hardcode hex colours.** Never introduce a new colour outside of `theme.css`.
- **Never add a new CSS custom property** without confirming it belongs in the global token system.
- The canonical surface tokens are `--surface` and `--theme`. Tokens like `--surfaceMain`, `--section-card-bg`, `--page-card-bg`, `--row-background` are deprecated aliases pointing at `--surface` and will be removed at the end of the layer sweep.

### 3.2 Key Colour Tokens (quick reference)
| Token | Purpose |
|---|---|
| `--primary` / `--accentText` | Brand red — headings, active states, primary fills |
| `--primary-hover` | Brand red, hover / pressed |
| `--surface` | Base surface fill — `<LayerSurface>` |
| `--theme` | Tinted surface fill — `<LayerTheme>` |
| `--surfaceMain` / `--page-card-bg` | Deprecated aliases of `--surface` (still defined) |
| `--section-card-bg` | **= `--theme`**, not `--surface` — second rung of the ladder (§3.0a-2) |
| `--control-on-theme-bg` / `-hover` / `-active` | Control fills for controls sitting on a `--theme` layer (§3.0a-2) |
| `--control-disabled-bg` / `--control-disabled-text` | Disabled controls. Use these, not `opacity: .5` |
| `--accent-text-on-tint` | The accent as a LABEL on an accent-tinted fill (Secondary / Ghost / Theme buttons) |
| `--input-placeholder` / `--toggle-knob` / `--toggle-track-off` | Placeholder text, switch knob, switch off-track |
| `--text-1` | Body text on a surface (use opacity for muted copy) |
| `--text-2` / `--onAccentText` | **On-accent** text (white on brand red). NOT muted body text |
| `--success-base` / `--danger-base` / `--warning-base` | Status colours |
| `--text-h1` … `--text-h4`, `--text-body`, `--text-body-sm`, `--text-label`, `--text-caption` | Type scale |
| `--separating-line` | The only allowed line inside a table / list |
| `--input-ring` / `--checkbox-ring` / `--ghostbutton-ring` / `--focus-ring` | The allowed outline tokens (§3.0a). Each has a `-color` partner — see the PAIRS note in §3.0a |
| `--control-height` | 44px control floor |
| `--page-stack-gap` | Gap between stacked sections |
| `--layout-card-gap` | Gap inside a section card |
| `--section-card-padding` | Padding inside section cards |
| `--page-card-padding` | Padding inside the main page card |

**Corrected — these were documented above but have never existed in `theme.css`:**
`--accentMain`, `--text-primary`, `--text-secondary` and `--border` have **no definition anywhere**. They are **not** to be used, and they have deliberately NOT been defined — giving one a value would change what any element referencing it renders. Every staff reference to them has now been resolved at the call site, so `undefined-tokens` is at **0**: `npm run check:design` fails the build if a new one appears. See §7.1 of [docs/ui/staff-design-governance.md](docs/ui/staff-design-governance.md) for what each one was resolved to.

Other names that do not exist, and what to reach for instead: `--text-body-xs` → `--text-caption`, `--font-mono` → `--font-family-mono`, `--accent` / `--accentMain` → `--accentText` or `--primary`, `--accent-dark` → `--accent-purple`, `--surface-dark` → `--media-letterbox-bg` (video matte) or `--theme`, `--control-height-md` → `--control-height`, `--text-small` → `--text-body-sm`, `--primary-surface` → `--secondary`, `--shadow-rgb` → the `--shadow-*` scale.

A handful of tokens are legitimately defined at **runtime**, as an inline custom property set from JS and read back from CSS: `--font-inter`, `--portrait-sidebar-top`, `--video-editor-max-width`, `--video-editor-aspect-ratio`, `--app-card-grid-min`, `--job-tracker-phase-color`. Each is registered against its owning component in `RUNTIME_TOKEN_SOURCES` (`tools/scripts/check-design-governance.js`). If you add one, register it there — otherwise the build fails.

### 3.3 Layout Class System (follow this hierarchy strictly)
```
.app-page-shell        → full page container, wraps everything
  .app-page-card       → main surface card (background: var(--page-card-bg))
    .app-page-stack    → vertical flex stack with var(--page-stack-gap)
      .app-section-card  → inner section card (background: var(--section-card-bg))
```
- The nesting pattern alternates surface levels — do not flatten or skip levels.
- Never invent a new wrapper class if one of the above fits.
- Cards nested inside `.app-section-card` children use the same `.app-section-card` class or the `Card` component.

### 3.4 Shared UI Components — Use These, Do Not Recreate
| Component | Location | Use for |
|---|---|---|
| `LayerSurface` | `src/components/ui/LayerSurface.js` | Canonical "surface" layer — base of every card / section |
| `LayerTheme` | `src/components/ui/LayerTheme.js` | Canonical "theme" layer — alternates with LayerSurface inside nesting |
| `Section` | `src/components/Section.js` | Titled section card (renders LayerSurface internally) |
| `SectionCard` / `Card` | `src/components/ui/Card.js` | Bare card wrapper (renders LayerSurface internally) |
| `ProtectedRoute` | `src/components/ProtectedRoute.js` | Role-gated page wrapper |
| `Sidebar` | `src/components/Sidebar.js` | Global sidebar — do not duplicate |
| `Layout` | `src/components/Layout.js` | Global page layout shell |
| `DropdownField` | `src/components/ui/dropdownAPI/DropdownField.js` | **The** canonical dropdown — see §3.4a |
| `MultiSelectDropdown` | `src/components/ui/dropdownAPI/MultiSelectDropdown.js` | Multi-select variant of the canonical dropdown |

Before building any new UI element, search `src/components/` for an existing match.

### 3.4a Dropdowns — THE LAW

**Every dropdown / select control in the app MUST be the shared `DropdownField`** (or
`MultiSelectDropdown` for multi-select). This guarantees one consistent in-app dropdown
style and behaviour (theme tokens, keyboard/ARIA, mobile touch targets, dev-overlay
tracing) everywhere.

1. **Never** render a raw `<select>` for user-facing UI. Migrate existing ones to
   `DropdownField` (it accepts `<option>` children as a drop-in migration path).
2. Pass options as `options={[{ value, label, description?, disabled? }]}` (or `<option>`
   children). Read the choice from `onChange(event)` via `event.target.value` — it emits a
   `<select>`-compatible synthetic event — or from `onValueChange(value, option)`.
3. Do not restyle dropdowns with one-off CSS. The look lives in the dropdown family
   (`src/styles/families/dropdowns.css`) + control tokens. New shared rules belong there.
4. Native `<select>` is allowed only in non-product contexts already exempt from the design
   system (e.g. functional diagram primitives / dev tooling).

### 3.5 Spacing Rules
- Use `var(--page-stack-gap)` for gaps between stacked section cards.
- Use `var(--layout-card-gap)` for gaps inside a section card.
- Use `var(--section-card-padding)` / `var(--page-card-padding)` for padding — do not override with arbitrary pixel values unless no token exists and the reason is documented inline.
- Outer page padding must stay consistent with existing pages. Match the pattern `padding: "8px 8px 32px"` used on existing pages unless the global system defines otherwise.

### 3.6 Responsive Design — Always Required
- Every change must work on desktop (1280px+), tablet (768–1279px), and mobile (< 768px).
- Use `grid` with `repeat(auto-fit, minmax(..., 1fr))` for responsive card grids — not hardcoded column counts.
- Use `src/hooks/useIsMobile.js` for conditional mobile logic — do not add `window.innerWidth` checks inline.
- Touch targets must be at least 44×44px.
- Mobile layout must be considered by default — not added as an afterthought.

---

## 4. File Structure Rules

### 4.1 Where Changes Belong
Before creating a new file, check:
- Does this change belong inside an existing page file? (`src/pages/...`)
- Does it belong inside an existing tab component? (`src/components/<Feature>/tabs/...`)
- Does it belong inside an existing section component? (`src/components/<Feature>/...`)

If yes → edit the existing file. Do not create a new file just to isolate a small change.

### 4.2 When to Create a New File
Only create a new file when:
- The feature is large enough that the existing file would become unmanageable.
- The feature is logically separate (a new tab, a new modal, a new standalone section).
- The new file belongs in a folder already linked to the parent page/feature.

### 4.3 Folder Structure Contract
```
src/
  pages/           → Next.js page routes only
  components/      → UI components, grouped by feature
    <Feature>/
      tabs/        → Tab panel components
      index.js     → Feature entry component
  features/        → Self-contained feature modules (jobCards, hr, vhc, etc.)
  hooks/           → React hooks only
  lib/
    database/      → All Supabase queries and DB helpers
    auth/          → Auth utilities and role guards
    <domain>/      → Domain-specific logic (jobs, hr, parts, etc.)
  utils/           → Stateless utility functions
  config/          → App-wide configuration constants
  context/         → React context providers
  styles/          → Global CSS and theme files only
```

- Do not put DB queries in page files.
- Do not put business logic in components — it belongs in `lib/` or `hooks/`.
- Do not scatter related files across unrelated folders.

---

## 5. Database Rules

- **Schema reference:** `src/lib/database/schema/schemaReference.sql`
- **DB helpers:** `src/lib/database/<domain>.js` (e.g. `jobs.js`, `hr.js`, `vehicles.js`)
- **Never guess** column names, table names, foreign key relationships, or status/enum values. Read the schema first.
- **Never write raw Supabase queries in page or component files.** Add them to the relevant DB helper in `src/lib/database/`.
- Check the relevant DB helper before writing new query logic — the function may already exist.
- Match existing query patterns (select, filter, join style) used in that helper file.
- Prisma schema at `prisma/schema.prisma` covers: Vehicle, Customer, JobCard, PartsRequest, TimeEntry, MotTest, Sale — reference it for model relationships.

---

## 6. Auth and Role Rules

- Session resolved via NextAuth.js — use `useSession()` on the client or `getServerSideProps` with `getSession()` on the server.
- User context available via `src/context/UserContext.js`.
- Role constants: `src/lib/auth/roles.js` — import `HR_CORE_ROLES`, `MANAGER_SCOPED_ROLES`, etc. Do not hardcode role strings.
- Role guard helper: `src/lib/auth/roleGuard.js` — use `hasAnyRole()` for checks.
- Page-level protection: wrap with `ProtectedRoute` component from `src/components/ProtectedRoute.js`.
- API-level protection: use `getUserFromRequest` from `src/lib/auth/getUserFromRequest.js`.

---

## 7. Global Design Safety Rules

**Any change that touches the following requires an explicit stop-and-confirm before proceeding:**
- `src/styles/theme.css` — colour tokens or design tokens
- `src/styles/staffglobal.css` — base layout classes or global resets
- `src/components/Layout.js` — global page shell
- `src/components/Sidebar.js` — global sidebar
- `src/components/Section.js` or `src/components/ui/Card.js` — canonical card components
- `src/context/*.js` — any global context provider

When flagging a global change, state:
- What file would be changed
- What the change is
- Which pages/components would be affected
- Why it cannot be done locally instead

Do not make silent global design changes. Local page changes must stay local.

---

## 8. Prompt Handling Rules

For every request:
1. State the task in one sentence.
2. Inspect the master rules (this file) and all relevant existing files before writing code.
3. If the request is ambiguous, conflicting, or could affect global design — ask one focused clarification question before proceeding.
4. If the request is clear and local in scope — proceed without delay.
5. Keep work scoped to the request. Do not refactor surrounding code unless it directly blocks the task.
6. Do not rename or move files unless it clearly improves organisation for the feature being changed and does not cause wider breakage.

---

## 9. Output Format Rules

When returning code changes, always include:
1. **Folder path** and **file name**
2. **Full updated file** — not partial snippets (for edited files)
3. **Short description** of what the file does and why it was changed
4. **Files reviewed** during the task (even if not changed)
5. **DB schema checked?** — yes/no + what was verified
6. **Scope** — local (page/component only) or shared/global (flag if global)

Do not return partial diffs or code fragments for existing files.
If creating a new file, state why an existing file could not be used instead.

---

## 10. One-Off Styles — Restricted

- Do not introduce one-off inline styles for colour, spacing, or layout if a token or class already covers it.
- If a one-off style is genuinely required, add a comment on the same line explaining why.
- Do not introduce new CSS class names outside of `staffglobal.css` (or the owning `families/*.css` file) without justification.
- Do not add Tailwind utility classes. There is no Tailwind build in this project (see §1).

---

## 11. Quick Reference — Key File Locations

| What | Where |
|---|---|
| Colour + design tokens | `src/styles/theme.css` |
| Layout classes | `src/styles/staffglobal.css` |
| Shared UI families | `src/styles/families/*.css` |
| Family registry | `src/components/ui/variants.js` |
| Customer (/website) styles | `src/styles/custglobal.css` |
| Design governance guide | `docs/ui/staff-design-governance.md` |
| Design governance check | `npm run check:design` |
| Global page layout | `src/components/Layout.js` |
| Sidebar | `src/components/Sidebar.js` |
| Section card | `src/components/Section.js` |
| Bare card | `src/components/ui/Card.js` |
| Role constants | `src/lib/auth/roles.js` |
| Role guard | `src/lib/auth/roleGuard.js` |
| User context | `src/context/UserContext.js` |
| Supabase client | `src/lib/database/supabaseClient.js` |
| DB schema SQL | `src/lib/database/schema/schemaReference.sql` |
| DB helpers | `src/lib/database/<domain>.js` |
| Mobile detection | `src/hooks/useIsMobile.js` |
| VHC status engine (single source of truth) | `src/features/vhc/vhcStatusEngine.js` |
| VHC item state primitives | `src/lib/vhc/vhcItemState.js` |
| Path alias | `@/` → `src/` |

---

*This file is the law. If a future prompt conflicts with these rules, the rules win. Flag the conflict rather than silently breaking them.*
