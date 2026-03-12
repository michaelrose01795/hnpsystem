# HNP System Dead Code Audit
<!-- file location: docs/cleanup-audit.md -->

**Date:** 2026-03-12
**Scope:** `src/` directory — ~520 JS/TS files across 195 directories
**Method:** Import tracing from live routes inward. Only files reachable from active navigation or auth flow are considered live.

---

## Active Route and Feature Map

All routes listed in `src/config/navigation.js` and `src/config/navLinks.js` are confirmed live. The sidebar (`src/components/Sidebar.js`) renders links dynamically by role. All pages below have active navigation entries or are part of the auth/token flow.

| Module | Key Pages | Status |
|--------|-----------|--------|
| Auth | `/login`, `/password-reset/reverted` | Live |
| Job Cards | `/job-cards`, `/job-cards/[jobNumber]`, `/job-cards/create`, `/job-cards/myjobs`, `/job-cards/archive` | Live |
| Parts | `/parts`, `/parts/goods-in`, `/parts/deliveries`, `/parts/delivery-planner`, `/parts/create-order`, `/parts/manager` | Live |
| VHC | `/vhc`, `/vhc/customer-view/[jobNumber]`, `/vhc/customer-preview/[jobNumber]`, `/vhc/share/[jobNumber]/[linkCode]` | Live |
| HR | `/hr/*` (all 10 sub-pages) | Live |
| Accounts | `/accounts/*` | Live |
| Dashboard | `/dashboard`, `/dashboard/workshop`, `/dashboard/parts`, `/dashboard/managers`, etc. | Live |
| Customer Portal | `/customer/*` | Live |
| Admin | `/admin/users`, `/admin/profiles/[user]` | Live |
| Tracking | `/tracking` | Live |
| Workshop | `/workshop`, `/workshop/consumables-tracker` | Live |
| Messaging | `/messages` | Live |
| Other | `/appointments`, `/clocking/*`, `/tech/*`, `/valet`, `/newsfeed`, `/stock-catalogue`, `/profile` | Live |
| Dev only | `/dev/user-diagnostic` (sidebar, non-production), `/dev/status-snapshot` (no nav link) | Dev only |

---

## Confirmed Dead Files — DELETE

These files have zero live consumers. Evidence provided per file.

### 1. `src/components/CustomerViewPreview.js`
- **Why dead:** Imported on line 11 of `src/pages/login.js` but never rendered. The JSX tag `<CustomerViewPreview` appears nowhere in the codebase.
- **References:** `login.js:11` only — a dead import, not a live render
- **Confidence:** HIGH
- **Action:** Delete file + remove import line from `login.js`

### 2. `src/components/ui/layout-system/StandardCard.js`
- **Why dead:** Only present in the barrel `layout-system/index.js`. No page or component imports `StandardCard` directly.
- **References:** `layout-system/index.js` barrel export only
- **Confidence:** HIGH
- **Action:** Delete file + remove export from barrel

### 3. `src/components/ui/layout-system/SurfaceCard.js`
- **Why dead:** Same situation as StandardCard. Only in barrel, never consumed.
- **References:** `layout-system/index.js` barrel export only
- **Confidence:** HIGH
- **Action:** Delete file + remove export from barrel

### 4. `src/lib/data/consumablesSample.js`
- **Why dead:** Sample/seed data file. No imports found anywhere in the codebase.
- **References:** None found
- **Confidence:** HIGH
- **Action:** Delete file

---

## Dead Barrel Exports — REMOVE EXPORT ONLY (keep files)

These are exported from barrel index files but never imported by any real page or component.

| Export | Barrel | Keep File? | Notes |
|--------|--------|------------|-------|
| `StandardCard` | `layout-system/index.js` | NO | Delete file too (see above) |
| `SurfaceCard` | `layout-system/index.js` | NO | Delete file too (see above) |
| `AccentSurface` | `layout-system/index.js` | YES | Possibly planned for future use |
| `SectionHeaderRow` | `layout-system/index.js` | YES | Possibly planned for future use |
| `ToolbarRow` | `ui/index.js` | YES | 4 pages still use old layout pattern |

---

## Dead Code Inside Live Files

| File | Dead Code | Confidence | Action |
|------|-----------|------------|--------|
| `src/pages/login.js:11` | `import CustomerViewPreview from "@/components/CustomerViewPreview"` — never rendered | HIGH | Remove line |
| `src/styles/appTheme.js` | `vhcLayoutStyles` export — used in exactly one file (`myjobs/[jobNumber].js`) | MEDIUM-HIGH | Move inline to that file |
| `src/general/hooks/` | Empty directory | HIGH | Delete |
| `src/general/utils/` | Empty directory | HIGH | Delete |

---

## Ghost Dependency Chain Found

### Chain: `Card.js → SectionCard` (Triple Alias)

```
Card.js  (real component at src/components/ui/Card.js)
  └── Section.js  (default re-export only: `export { default } from "./ui/Card"`)
        ├── MetricCard.js  (imports Section → re-exports as: `export const SectionCard = Section`)
        │     └── 17 files import { SectionCard } from "@/components/HR/MetricCard"
        └── DashboardPrimitives.js  (imports Section → re-exports as: `export const SectionCard = Section`)
              └── 3 files import { SectionCard } from "@/components/dashboards/DashboardPrimitives"
```

**Why this is a ghost chain:** `SectionCard` is the same as `Card` but passes through three files before reaching its consumers. `MetricCard.js` and `DashboardPrimitives.js` are not card implementations — they just re-export the alias. The `Section.js` file already has a comment saying it was written to replace these re-exports.

**Consumers of the dead re-exports (20 files total):**

Via MetricCard (17 files):
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

Via DashboardPrimitives (3 files):
- `src/components/dashboards/RetailManagersDashboard.js`
- `src/components/dashboards/WorkshopManagerDashboard.js`
- `src/components/dashboards/AfterSalesManagerDashboard.js`

**Fix:** Add `export { default as SectionCard } from "./ui/Card"` to `Section.js`, update 20 consumers to import from `@/components/Section`, then remove the intermediate re-exports from `MetricCard.js` and `DashboardPrimitives.js`.

---

## Naming Collision (Document Only — No Code Change)

Two unrelated things share the name `vhcModalStyles`:

| Location | What it contains | Used by |
|----------|-----------------|---------|
| `src/styles/appTheme.js` → `export const vhcModalStyles` | Modal **shell** layout styles (overlay, container, header, body, footer) | `VHCModalShell.js` |
| `src/components/VHC/vhcModalStyles.js` | **Field-level** input/label styles for VHC detail forms | 10 VHC detail modal components |

These are different things. Do not rename or merge either. Add clarifying comments to both files.

---

## Dual Layout System (Deferred — No Change Yet)

The codebase has two competing layout patterns:

**Old pattern** (`src/components/ui/`): Simple div wrappers
- `PageWrapper` — `app-page-stack` class
- `PageContainer` — max-width constraint
- `PageSection` — flex column with gap

Used by these 4 active pages:
- `src/pages/clocking/[technicianSlug].js`
- `src/pages/accounts/create.js`
- `src/pages/accounts/transactions/[accountId].js`
- (minor usage in other files)

**New pattern** (`src/components/ui/layout-system/`): DevLayoutSection wrappers
- `PageShell`, `ContentWidth`, `SectionShell`, `TabRow`, `FilterToolbarRow`, `StatCard`

Used by most other pages.

**Decision:** Do not migrate the 4 old-pattern pages yet. Migration requires visual review per page. Add deprecation comments to old components and leave the files in place.

---

## Items Left for Manual Review

| Item | Why Deferred | Risk if Changed |
|------|-------------|-----------------|
| `ToolbarRow.js` file | Export removed from barrel but file kept — confirm no dynamic `require()` references before deleting | Low |
| `AccentSurface.js` file | Export removed from barrel — kept in case planned | Low |
| `SectionHeaderRow.js` file | Export removed from barrel — kept in case planned | Low |
| Old layout pattern migration | Visual review required per page | Medium |
| Three modal style systems | `popupStyleApi.js`, `appTheme` popup styles, VHC field styles — different scopes, need dedicated refactor | Low |
| `NotesTab_New.js` / `PartsTab_New.js` naming | The `_New` suffix is misleading; files are the real implementations. Rename deferred to avoid breaking imports | Low |
| `tabAPI/TabGroup.js` vs `layout-system/TabRow.js` | Different roles — TabGroup has real tab logic; TabRow wraps DevLayout. Not a true duplicate. | None |

---

## Files Confirmed NOT Dead (Do Not Touch)

- `createVhcButtonStyle`, `vhcModalStyles`, `vhcModalContentStyles` in `appTheme.js` — all actively used by VHC modals
- `src/codex/notify-status-change.js` — imported by `src/lib/database/jobs.js`
- `src/lib/tracking/mockEntries.js` — used by `src/pages/api/tracking/snapshot.js` as fallback data
- `src/styles/formStyles.js` — used in AccountForm.js and CompanyAccountForm.js
- `src/styles/theme.js` — sole input to `themeProvider.js`
- All auth, middleware, and role-access files
- All dev pages (`/dev/*`) — intentional, shown in sidebar in non-production

---

## Proposed Cleanup Plan

See the execution in order:

1. Write this audit file (done)
2. Phase 1: Delete 4 dead files, remove dead import in login.js, clean barrel exports, delete empty dirs
3. Phase 2: Flatten the SectionCard ghost chain (20 consumer files + 2 re-export files)
4. Phase 3: Inline `vhcLayoutStyles` to its sole consumer; remove export from appTheme.js
5. Phase 4: Add deprecation comments to old layout wrappers + naming-collision comments + write cleanup-summary.md
