# testing.md — Build, Lint, Checks

> Read only when running checks, builds, or verifying a change.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build (type / lint failures will surface here) |
| `npm run lint` | ESLint pass |
| `npm run check:borders` | Enforce the Borders Law ([tools/scripts/check-borders.js](../../../tools/scripts/check-borders.js)) |

## Before Committing a UI Change

1. `npm run check:borders` — must exit 0.
2. `npm run lint` on touched files where possible.
3. Visually confirm in dev server if the change is non-trivial.

## Verifying Behaviour

For UI / frontend changes, start the dev server and exercise the feature in a browser before reporting "done". Type checks and tests verify correctness, not feature behaviour. If you can't test the UI, say so explicitly.

## Keep Output Short

- Don't paste full build logs into chat. Quote only the failing lines.
- Don't run long-running commands you don't need to read.
