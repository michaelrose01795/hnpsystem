# CODEX.md — HNPSystem AI Entrypoint (Slim)

Same rules as [CLAUDE.md](CLAUDE.md). Codex agents follow the same router and the same token-saving discipline.

---

## Project Identity
HNPSystem — Dealer Management System for Humphries & Parks. Next.js (Pages Router) + React + Supabase + NextAuth + Tailwind v4. Path alias `@/` → `src/`.

---

## Must-Follow Rules

1. `.js` only — no `.tsx`.
2. Full paste-ready files when creating or replacing a file.
3. `// file location: <path>` header on every new file.
4. Features stay inside their own folder.
5. Respect role-based access — import from `src/lib/auth/roles.js`.
6. Do not break real app routes when editing presentation/demo flows.
7. Ask before large refactors, global style changes, schema changes.
8. Borders Law + Layer Primitives Law from root `CLAUDE.md` apply.

---

## Token-Saving Discipline

- Identify the smallest file set first.
- Targeted reads only — no broad repo searches unless the target is unknown.
- Do not open `docs/ai/rules/*.md` unless on-topic.
- Do not re-read unchanged files.
- Summarise before editing. Keep terminal output short.

---

## Routing

| Task touches… | Read |
|---|---|
| Project identity, stack | [rules/project.md](rules/project.md) |
| UI, tokens, `staffglobal.css` | [rules/ui.md](rules/ui.md) |
| File placement | [rules/file-structure.md](rules/file-structure.md) |
| Auth, roles, Keycloak | [rules/permissions.md](rules/permissions.md) |
| Supabase, schema | [rules/database.md](rules/database.md) |
| Presentation mode | [rules/presentation.md](rules/presentation.md) |
| Build, lint, tests | [rules/testing.md](rules/testing.md) |
| Installed agent skills, Codex/Claude skill loading, `.agents/skills` | [rules/skills.md](rules/skills.md) |
| User prompt shortcuts | [rules/prompt-shortcuts.md](rules/prompt-shortcuts.md) |

---

## Output Format

End every response with: files created, files changed, files reviewed, DB schema checked?, scope (local/shared/global).
