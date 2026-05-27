# file-structure.md — Where Code Belongs

## Folder Contract

```
src/
  pages/           Next.js page routes only
  components/      UI components, grouped by feature
    <Feature>/
      tabs/        Tab panel components
      index.js     Feature entry component
  features/        Self-contained feature modules (jobCards, hr, vhc, ...)
  hooks/           React hooks only
  lib/
    database/      All Supabase queries / DB helpers
    auth/          Auth utilities + role guards
    <domain>/      Domain logic (jobs, hr, parts, ...)
  utils/           Stateless utility functions
  config/          App-wide config constants
  context/         React context providers
  styles/          Global CSS + theme files only
```

## Before Creating a New File

Check if the change belongs in:
1. An existing page file (`src/pages/...`)
2. An existing tab component (`src/components/<Feature>/tabs/...`)
3. An existing section component (`src/components/<Feature>/...`)

If yes → edit it. Don't create a new file just to isolate a small change.

## Create a New File Only When

- The existing file would become unmanageable.
- The feature is logically separate (new tab, new modal, new standalone section).
- The new file belongs in a folder already linked to its parent page/feature.

## Hard Rules

- **No DB queries** in page or component files — put them in `src/lib/database/<domain>.js`.
- **No business logic** in components — it belongs in `lib/` or `hooks/`.
- **No scattering** related files across unrelated folders.
- **Don't rename / move** files unless it clearly improves organisation and won't cause wider breakage.

## File Headers

Every new file starts with:
```js
// file location: src/path/to/the/file.js
```

## Output Format When Creating / Replacing Files

Always paste the **full file**, not a diff. State the folder + file name above the code block. If a new file is created, justify why an existing file couldn't be used.
