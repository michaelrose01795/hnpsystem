# CLAUDE.md — HNPSystem AI Entrypoint (Slim)

> Master project rules live in the root `CLAUDE.md`. This file is the **token-efficient router** for AI agents working in `docs/ai/`. Read only what you need.

---

## Project Identity (1 line)
HNPSystem — Dealer Management System for Humphries & Parks. Next.js (Pages Router) + React + Supabase + NextAuth + Tailwind v4 + CSS custom properties. Path alias `@/` → `src/`.

---

## Must-Follow Rules (always)

1. **Use `.js` files, not `.tsx`.**
2. **Full paste-ready files** when creating or replacing a file (no partial diffs for new files).
3. Add `// file location: <path>` at the top of every new file.
4. Keep features inside their own folder under `src/components/<Feature>/` or `src/features/<feature>/`.
5. **Role-based access must be respected** — import from `src/lib/auth/roles.js`, never hardcode role strings.
6. **Never break real app routes** when editing presentation / demo flows.
7. **Ask before large refactors, global style changes, or schema changes.** Local changes proceed; global changes stop-and-confirm.
8. Follow the **Borders Law** and **Layer Primitives Law** in the root `CLAUDE.md` (LayerSurface ↔ LayerTheme alternation, no decorative borders).

---

## Token-Saving Discipline (read every task)

- Start by identifying the **smallest set of files** required.
- Prefer **targeted file reads** over repo-wide search. No broad `grep` / `find` unless the target is unknown.
- Do **not** open `docs/ai/rules/*.md` unless the task matches its topic.
- Do **not** re-read a file already read in this session unless it changed.
- Summarise findings briefly before editing.
- Keep terminal output short. Do not paste large logs.
- Use `/clear` between unrelated tasks.

---

## Routing — Read Only the Relevant Rule File

| If the task touches… | Read |
|---|---|
| Project identity, stack, branching | [rules/project.md](rules/project.md) |
| Colours, tokens, layout shells, `staffglobal.css`, components | [rules/ui.md](rules/ui.md) |
| New file placement, folder hierarchy | [rules/file-structure.md](rules/file-structure.md) |
| Auth, roles, route protection, Keycloak | [rules/permissions.md](rules/permissions.md) |
| Supabase, schema, queries, DB helpers | [rules/database.md](rules/database.md) |
| Presentation / demo mode | [rules/presentation.md](rules/presentation.md) |
| Build, lint, border check, tests | [rules/testing.md](rules/testing.md) |
| Reusable user prompts | [rules/prompt-shortcuts.md](rules/prompt-shortcuts.md) |

If a task spans two areas, read both — nothing else.

---

## Output Format When Editing Code

End every response with:
- Files created
- Files changed
- Files reviewed (not changed)
- DB schema checked? yes/no + what
- Scope: local | shared | global (flag global)
