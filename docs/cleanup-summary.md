# HNP System Dead Code Cleanup Summary
<!-- file location: docs/cleanup-summary.md -->

**Completed:** 2026-03-12
**Based on audit:** [docs/cleanup-audit.md](./cleanup-audit.md)
**Scope:** Evidence-based structural cleanup before visual redesign. All changes traced from live routes inward.

---

## Files Deleted

| File | Size | Reason |
|------|------|--------|
| `src/components/CustomerViewPreview.js` | ~100 lines | Imported in login.js but never rendered. Zero JSX usages. |
| `src/components/ui/layout-system/StandardCard.js` | 18 lines | Only in barrel export, never imported by any page or component. |
| `src/components/ui/layout-system/SurfaceCard.js` | 18 lines | Only in barrel export, never imported by any page or component. |
| `src/lib/data/consumablesSample.js` | ~30 lines | Sample seed data, zero imports anywhere in codebase. |
| `src/general/hooks/` (empty dir) | — | Empty directory, no files. |
| `src/general/utils/` (empty dir) | — | Empty directory, no files. |

---

## Files Modified

### Barrel index cleanup

| File | Change |
|------|--------|
| `src/components/ui/layout-system/index.js` | Removed `StandardCard`, `SurfaceCard`, `AccentSurface`, `SectionHeaderRow` exports (files kept, exports removed) |
| `src/components/ui/index.js` | Removed `ToolbarRow` export (file kept, export removed) |

### Dead import removal

| File | Change |
|------|--------|
| `src/pages/login.js` | Removed dead `import CustomerViewPreview` on line 11 — was never rendered |

### Ghost chain resolution (20 files)

The `SectionCard` triple-alias chain has been flattened. All consumers now import directly from `@/components/Section`.

**`src/components/Section.js`** — added named `SectionCard` export alongside existing default export.

**`src/components/HR/MetricCard.js`** — removed `Section` import and `SectionCard` re-export.

**`src/components/dashboards/DashboardPrimitives.js`** — removed `Section` import and `SectionCard` re-export.

**17 HR/admin consumer files updated** (import source changed from `MetricCard` → `@/components/Section`):
- `src/components/HR/tabs/HRDashboardTab.js`
- `src/components/HR/tabs/AttendanceTab.js`
- `src/components/HR/tabs/EmployeesTab.js`
- `src/components/HR/StaffVehiclesCard.js`
- `src/components/HR/OvertimeEntriesEditor.js`
- `src/pages/admin/users/index.js`
- `src/pages/hr/attendance.js`
- `src/pages/hr/employees/index.js`
- `src/pages/hr/reports.js`
- `src/pages/hr/settings.js`
- `src/pages/hr/payroll.js`
- `src/pages/hr/training.js`
- `src/pages/hr/recruitment.js`
- `src/pages/hr/performance.js`
- `src/pages/hr/disciplinary.js`
- `src/pages/hr/index.js`
- `src/pages/hr/leave.js`

**3 dashboard consumer files updated** (import source changed from `DashboardPrimitives` → `@/components/Section`):
- `src/components/dashboards/RetailManagersDashboard.js`
- `src/components/dashboards/WorkshopManagerDashboard.js`
- `src/components/dashboards/AfterSalesManagerDashboard.js`

### Dead export removal + inline move

| File | Change |
|------|--------|
| `src/styles/appTheme.js` | Removed `vhcLayoutStyles` export (~175 lines); added clarifying comment above `vhcModalStyles` |
| `src/pages/job-cards/myjobs/[jobNumber].js` | Added local `vhcLayoutStyles` const (moved from appTheme — was the only consumer) |

### Deprecation comments added

| File | Note Added |
|------|-----------|
| `src/components/ui/PageWrapper.js` | Deprecated — new pages should use `PageShell` from layout-system |
| `src/components/ui/PageContainer.js` | Deprecated — new pages should use `ContentWidth` from layout-system |
| `src/components/ui/PageSection.js` | Deprecated — new pages should use `SectionShell` from layout-system |
| `src/styles/appTheme.js` | Naming collision clarification for `vhcModalStyles` |
| `src/components/VHC/vhcModalStyles.js` | Naming collision clarification (field-level styles, not shell styles) |

---

## Ghost Dependency Chain Resolved

**Before cleanup:**
```
Card.js
  └── Section.js (default alias)
        ├── MetricCard.js → re-exports SectionCard → 17 HR/admin files
        └── DashboardPrimitives.js → re-exports SectionCard → 3 dashboard files
```

**After cleanup:**
```
Card.js
  └── Section.js (canonical alias — default + named SectionCard export)
        └── 20 files import { SectionCard } from "@/components/Section" directly
```

The triple-alias chain is gone. `MetricCard.js` and `DashboardPrimitives.js` no longer act as intermediate re-export passthrough for a component they don't own.

---

## Items Left for Future Cleanup (Manual Review Required)

### 1. Old layout pattern migration (4 pages)
These pages still use the old `PageWrapper`/`PageContainer`/`PageSection` pattern. Deprecated comments added. Migration to `PageShell`/`ContentWidth`/`SectionShell` deferred — requires per-page visual review.
- `src/pages/clocking/[technicianSlug].js`
- `src/pages/accounts/create.js`
- `src/pages/accounts/transactions/[accountId].js`

### 2. Files with export removed but file kept
Confirm no dynamic `require()` or string-based imports before deleting:
- `src/components/ui/ToolbarRow.js` — export removed from barrel
- `src/components/ui/layout-system/AccentSurface.js` — export removed from barrel
- `src/components/ui/layout-system/SectionHeaderRow.js` — export removed from barrel

### 3. Three modal style systems (low risk, deferred)
Currently three separate modal styling patterns coexist:
- `src/components/popups/popupStyleApi.js` — used by 8 popup components
- `src/styles/appTheme.js` `popupOverlayStyles`/`popupCardStyles` — used by 21 files
- `src/components/VHC/vhcModalStyles.js` — VHC field-level styles (different scope, not a duplicate)

First two serve overlapping purposes. Consolidation deferred to a dedicated modal system refactor.

### 4. `_New` suffix naming
`NotesTab_New.js` and `PartsTab_New.js` are the real implementations (no older versions exist). The `_New` suffix is misleading. Renaming deferred to avoid import churn on large files.

### 5. Dev layout dual system
`tabAPI/TabGroup.js` (real tab logic) and `ui/layout-system/TabRow.js` (DevLayout wrapper) are different things and do not truly conflict. No action needed.

---

## Risks and Assumptions

- All import changes in Phase 2 (SectionCard ghost chain) are purely structural — the rendered component is identical (`Card.js` in both cases).
- The `vhcLayoutStyles` inline move preserves all CSS variable token references exactly — no visual change expected.
- `ToolbarRow.js`, `AccentSurface.js`, `SectionHeaderRow.js` files are kept until confirmed no dynamic imports reference them.
- `mockEntries.js` was confirmed live (used by tracking snapshot API as fallback) — not removed.
- `formStyles.js` was confirmed live (used by 2 form components) — not removed.
- All auth, middleware, and role-based access files untouched.
