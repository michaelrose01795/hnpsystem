# prompt-shortcuts.md — Reusable User Prompts

Copy-paste these to keep agent context small and focused.

---

## UI fix
> Read `docs/ai/rules/ui.md` only. Fix **[issue]** in **[file/route]**. Do not touch logic. Use existing tokens and shared components. Run `npm run check:borders` before finishing.

## Bug fix
> Inspect only **[files]**. Find the cause of **[bug]**. Plan first, wait for my approval, then edit. Do not run repo-wide searches.

## New component (local)
> Read `docs/ai/rules/ui.md` and `docs/ai/rules/file-structure.md`. Create a new component for **[purpose]** under `src/components/<Feature>/`. Use `LayerSurface`/`LayerTheme`, no borders, full paste-ready `.js` file with a `// file location:` header.

## New DB query
> Read `docs/ai/rules/database.md` and `src/lib/database/schema/schemaReference.sql`. Add a helper to `src/lib/database/<domain>.js` for **[purpose]**. Verify column names from schema. No raw Supabase calls outside the helper.

## Role-gated page
> Read `docs/ai/rules/permissions.md`. Add **[page]** at `src/pages/<route>.js` gated to **[roles]**. Import role constants from `src/lib/auth/roles.js`; wrap with `ProtectedRoute`.

## Presentation/demo edit
> Read `docs/ai/rules/presentation.md`. Update **[demo route]**. Do not touch any real app route, helper, or shared component. If a shared file would need to change, stop and ask.

## Refactor (large)
> Stop and propose a plan first. List affected files, scope (local/shared/global), and the smallest viable diff. Wait for approval before editing anything.

## Token saving (append to any prompt)
> Do not run broad repo searches. Do not read unrelated files. Do not re-read files already in context. Summarise findings briefly. Keep terminal output short.

## Verify before finishing
> Run `npm run check:borders` and `npm run lint`. Report only failing lines. Confirm the change in the dev server if it is UI-visible.
