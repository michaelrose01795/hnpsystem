# CLAUDE.md — Master Rules for HNPSystem

**Read this file in full before touching any code.**
This is the single source of truth for all UI, layout, file structure, database, and edit discipline rules.
It applies to every prompt, every session, every agent.

---

## 1. Project Identity

- **App:** HNPSystem — Dealer Management System for Humphries & Parks
- **Stack:** Next.js (Pages Router), React, Supabase (PostgreSQL), NextAuth.js, Tailwind CSS v4, CSS custom properties
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

### 3.1 Token Sources
- **Colour tokens:** `src/styles/theme.css` — CSS custom properties only (e.g. `var(--accentMain)`, `var(--surfaceMain)`, `var(--text-secondary)`)
- **Base layout classes:** `src/styles/globals.css` — `.app-page-shell`, `.app-page-stack`, `.app-section-card`, `.app-page-card`
- **Never hardcode hex colours.** Never introduce a new colour outside of `theme.css`.
- **Never add a new CSS custom property** without confirming it belongs in the global token system.

### 3.2 Key Colour Tokens (quick reference)
| Token | Purpose |
|---|---|
| `--accentMain` / `--accentText` | Brand red, headings, active states |
| `--surfaceMain` | Page-level card background |
| `--section-card-bg` | Inner section card background |
| `--text-primary` | Primary body text |
| `--text-secondary` | Muted / subtitle text |
| `--success-base` / `--danger-base` / `--warning-base` | Status colours |
| `--border` | Standard border colour |
| `--page-stack-gap` | Gap between stacked sections |
| `--layout-card-gap` | Gap inside a section card |
| `--section-card-padding` | Padding inside section cards |
| `--page-card-padding` | Padding inside the main page card |

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
| `Section` | `src/components/Section.js` | Titled section card on dashboard pages |
| `SectionCard` / `Card` | `src/components/ui/Card.js` | Bare card wrapper (no built-in title) |
| `ProtectedRoute` | `src/components/ProtectedRoute.js` | Role-gated page wrapper |
| `Sidebar` | `src/components/Sidebar.js` | Global sidebar — do not duplicate |
| `Layout` | `src/components/Layout.js` | Global page layout shell |

Before building any new UI element, search `src/components/` for an existing match.

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
- `src/styles/globals.css` — base layout classes or global resets
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
- Do not introduce new CSS class names outside of `globals.css` without justification.
- Do not add Tailwind utility classes that conflict with the existing CSS variable system.

---

## 11. Quick Reference — Key File Locations

| What | Where |
|---|---|
| Colour + design tokens | `src/styles/theme.css` |
| Layout classes | `src/styles/globals.css` |
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
