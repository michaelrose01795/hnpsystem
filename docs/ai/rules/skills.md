# Agent Skills

Use this file when a task mentions installed skills, skill routing, Codex, Claude, `npx skills`, `.agents/skills`, or `%USERPROFILE%\.codex\skills`.

## Discovery And Auto-Use

- Skills are not magic global rules for every prompt. They become available to compatible agents after the agent restarts or reloads its skill index.
- Codex can use globally installed skills such as `%USERPROFILE%\.codex\skills\impeccable` after restart.
- Codex, Claude, and other compatible tools can use project-local skills under `.agents\skills` when their runtime supports the Agent Skills format.
- If a skill is not appearing, restart the agent first. If it still does not appear, open the relevant `.agents\skills\<skill>\SKILL.md` manually and follow it as local instruction context.

## Routing Rule

- Load a skill when the user explicitly names it, for example `Use impeccable`, `Use gpt-taste`, `Use agent-coder`, or `Use sparc-spec`.
- Load a skill when the task clearly matches its purpose, for example frontend polish can use `impeccable`, `design-taste-frontend`, `gpt-taste`, or `redesign-existing-projects`.
- Do not load all installed skills. The Ruflo pack contains hundreds of skills; choose the smallest relevant skill.
- If two skills conflict, prefer the more specific skill, then apply HNPSystem root rules.

## HNPSystem Priority

Root project rules always win:

1. `AGENTS.md`
2. Root `CLAUDE.md` if present
3. `docs/ai/CLAUDE.md` or `docs/ai/CODEX.md`
4. The relevant `docs/ai/rules/*.md`
5. Installed skill instructions

If a skill asks for global styles, schema changes, direct database queries in components, hardcoded colours, decorative borders, or role string literals, stop and follow the HNPSystem rules instead.

## Installed Skill Reference

See `docs/Intall.md` for install commands and examples. Current major groups:

- `impeccable` for frontend design, redesign, polish, audits, UX copy, responsive UI, accessibility, and hierarchy.
- Taste Skill pack for frontend taste, image-to-code, visual design directions, and redesign workflows.
- Ruflo skill pack for coding, workflow orchestration, automation, SPARC flows, vector work, observability, and agent coordination.

## Prompt Examples

```text
Use impeccable to audit this UI against AGENTS.md.
Use gpt-taste to polish this screen, but keep all HNPSystem border and layer rules.
Use agent-coder to implement the smallest safe change.
Use sparc-spec to write a specification before implementation.
Use agent-workflow to plan an automation flow.
```
