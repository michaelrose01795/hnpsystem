# AGENTS.md — Startup Instruction for Codex and All AI Agents

**This file must be read before any task begins.**

## Step 1 — Read the master rules file first

The full rules for this project live at:

```
/CLAUDE.md
```

Read that file completely before writing, editing, or planning any change.

## Step 2 — Confirm your task understanding

After reading CLAUDE.md, state in one sentence what the user is asking for.

## Step 3 — Check relevant files before changing anything

- Find the existing page, tab, or component the change belongs to
- Check for existing shared components, hooks, and DB helpers
- Read the DB schema at `src/lib/database/schema/schemaReference.sql` if the task touches data
- Check `src/styles/theme.css` and `src/styles/globals.css` for existing tokens and classes

## Step 4 — Assess global impact

If your change touches any of the following, stop and flag it before proceeding:
- `src/styles/theme.css`
- `src/styles/globals.css`
- `src/components/Layout.js`
- `src/components/Sidebar.js`
- `src/components/Section.js`
- `src/components/ui/Card.js`
- Any file in `src/context/`

## Step 5 — Then and only then, write the code

Follow all rules in CLAUDE.md. Return the full updated file, not partial snippets.

---

*Rules summary: read CLAUDE.md → understand task → inspect existing files → flag globals → write code.*
