# CLAUDE.md — HNPSystem AI Entrypoint (Slim)

> Master project rules live in the root `CLAUDE.md`. This file is the token-efficient router for AI agents working in `docs/ai/`. Read only what you need.

---

## Project Identity (1 line)

HNPSystem — Dealer Management System for Humphries & Parks. Next.js (Pages Router) + React + Supabase + NextAuth + Tailwind v4 + CSS custom properties. Path alias `@/` → `src/`.

---

## Must-Follow Rules (always)

1. Use `.js` files, not `.tsx`.
2. Full paste-ready files when creating or replacing files.
3. Add `// file location: <path>` at the top of every new file.
4. Keep features inside their own folder under `src/components/<Feature>/` or `src/features/<feature>/`.
5. Role-based access must be respected. Import roles from `src/lib/auth/roles.js`, never hardcode role strings.
6. Never break real app routes when editing presentation or demo flows.
7. Local page changes may proceed without confirmation. Shared system changes, global styling changes, architecture changes, routing changes, authentication changes, permission changes, or database schema changes require approval before implementation.
8. Follow the Borders Law and Layer Primitives Law in the root `CLAUDE.md` (LayerSurface ↔ LayerTheme alternation, no decorative borders).

---

## Development Approach

### File Creation Control

For existing pages, tabs, cards, tables, forms, modals, and sections, prefer updating the existing implementation before creating new files.

Reuse existing components, hooks, utilities, styling systems, layouts, and patterns whenever practical.

Do not create new folders or feature structures for small enhancements, UI adjustments, tab content changes, field additions, table updates, workflow adjustments, or local page improvements.

Create new files only when they provide a clear maintainability, reusability, or architectural benefit.

Create new folders only for genuinely new features or systems expected to grow and be reused.

Avoid creating wrapper components, helper files, style files, mock data files, constants files, utility files, or one-time-use abstractions unless clearly justified.

Keep related logic together when the change is small and local to a single page, tab, or feature area.

When multiple implementation approaches are possible, prefer the solution that introduces the fewest new files while maintaining readability and maintainability.

### Existing Code Preference

When modifying an existing page, tab, modal, table, card, form, workflow, or feature, inspect and reuse the existing implementation first.

Do not replace working code with entirely new implementations unless there is a clear benefit.

Preserve existing behaviours, styling systems, permissions, APIs, routes, and data flows wherever possible.

Prefer incremental improvements over complete rewrites.

Prefer extending existing components over creating new components.

Prefer extending existing systems over creating new systems.

### Shared-First Development

Before creating page-specific styling, components, or behaviours, check whether an existing shared system can be extended.

Prefer improving shared systems so all relevant pages benefit automatically.

Avoid duplicating layouts, cards, buttons, tables, tabs, modals, forms, badges, status indicators, styling patterns, utilities, and business logic.

For staff-facing pages, follow and extend the existing `staffglobal.css` system before introducing page-specific alternatives.

For customer-facing pages, follow and extend the existing customer styling system before introducing page-specific alternatives.

If a requested change would affect shared systems used throughout the application, explain the impact and request approval before implementation.

### Simplicity First

Prefer extending existing systems over creating new systems.

Prefer modifying existing components over creating new components.

Prefer modifying existing pages over creating additional abstraction layers.

Avoid over-engineering.

Avoid creating structures that only serve a single page, tab, card, modal, workflow, or feature unless there is a clear future reuse case.

The simplest maintainable solution should be preferred over the most technically complex solution.

---

## Token-Saving Discipline (read every task)

* Start by identifying the smallest set of files required.
* Prefer targeted file reads over repo-wide searches.
* No broad grep/find scans unless the target is unknown.
* Do not open `docs/ai/rules/*.md` unless the task matches its topic.
* Do not re-read files already reviewed during the current task unless they changed.
* Summarise findings briefly before editing.
* Keep terminal output short.
* Do not paste large logs.
* Use `/clear` between unrelated tasks.
* Avoid unnecessary code generation.
* Avoid generating files that do not provide clear value.
* Avoid introducing abstractions that are not justified by reuse.

---

## Routing — Read Only the Relevant Rule File

| If the task touches…                                                 | Read                      |
| -------------------------------------------------------------------- | ------------------------- |
| Project identity, stack, branching                                   | rules/project.md          |
| Colours, tokens, layout shells, staffglobal.css, components          | rules/ui.md               |
| New file placement, folder hierarchy                                 | rules/file-structure.md   |
| Auth, roles, route protection, Keycloak                              | rules/permissions.md      |
| Supabase, schema, queries, DB helpers                                | rules/database.md         |
| Presentation / demo mode                                             | rules/presentation.md     |
| Build, lint, border check, tests                                     | rules/testing.md          |
| Installed agent skills, Codex/Claude skill loading, `.agents/skills` | rules/skills.md           |
| Reusable user prompts                                                | rules/prompt-shortcuts.md |

If a task spans multiple areas, read only the relevant rule files.

---

## Response Efficiency

Keep responses concise.

Do not provide lengthy explanations of implementation details unless specifically requested.

Do not explain every file, function, variable, styling change, or code decision.

Focus on what was changed rather than how every internal detail works.

Avoid large implementation reports, architectural essays, excessive reasoning, verbose summaries, and unnecessary documentation.

Use short status-style summaries whenever possible.

Only provide deeper explanations when explicitly requested.

---

## Output Format When Editing Code

End every response with:

* Files created
* Files changed
* Files reviewed
* Scope: Local / Shared / Global

Only include concise entries.

Do not generate large change reports unless specifically requested.

Do not provide unnecessary implementation breakdowns.

Do not document every internal code change unless requested.

If no files were created, changed, or reviewed, state that briefly and continue.
