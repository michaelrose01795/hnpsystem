# presentation.md — Presentation / Demo Mode

> Read only when the task touches a presentation, demo, or marketing flow (e.g. `/website`, walkthroughs, screenshot pages).

## Cardinal Rule

**Do not break real app routes when editing presentation or demo flows.**

If a change to a demo page would require touching a real route, helper, or shared component — stop and confirm first.

## Separation

- Presentation/demo code should live in its own folder (e.g. `src/pages/website/`, `src/features/<demo>/`).
- Shared components imported by both real and demo routes are **shared territory** — changes need the same caution as a global style change. See [ui.md §12](ui.md).
- Do not relax role checks, auth gates, or DB constraints to make a demo work. Use mock data instead.

## Mock vs Live Data

- Demo routes pulling from Supabase must use clearly scoped helpers (e.g. read-only, filtered, or fixtures).
- Never write demo-driven mutations into production tables.

## Visual Consistency

Demo routes still follow [ui.md](ui.md): same tokens, same Layer primitives, same Borders Law.
