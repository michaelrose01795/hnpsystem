# Phase 9 Workspace Navigation completion handoff

Phase 9 Group → Modules → Pages is implemented in the flagged Workspace Navigation path.

- Group selection still replaces the sidebar body.
- Dashboards remain separate.
- `ContextSidebar` now shows an accordion of manifest-derived Modules; one Module expands at a time, and the current/pending route opens its Module.
- Modules are presentation-only. Existing Group/Page permission selectors, `pageAccess`, sidebar snapshots and classic fallback remain authoritative.
- New metadata: `WORKSPACE_MODULES` in `src/config/workspace/departments.js`.
- New selectors: `getWorkspaceModules()` and `getActiveWorkspaceModule()` in `src/config/workspace/manifest.js`.
- `/dev/sidebar-access` was intentionally not changed.

Validation to run before release: `npm run test:unit -- src/config/workspace/manifest.test.js src/lib/sidebarAccess.test.js`, `npm run check:borders`, `npm run check:layers`, and targeted mobile/collapsed-rail QA.
