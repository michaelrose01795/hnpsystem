<!-- file location: docs/dev-layout-overlay.md -->
# Dev Layout Overlay

## Overview
The Dev Layout Overlay is an in-app developer tool for Humphries & Parks DMS to audit page layout consistency in real time.

It provides:
- Hierarchical section numbering (`1`, `2`, `2.1`, `2.2`)
- Stable section keys for long-term references
- Overlay modes (`labels`, `details`, `inspect`)
- Section inspector metadata and issue tags
- Copy-ready prompt generation for Codex/Claude
- Basic alignment/distance guides for selected sections

## Access and Safety
- Access is role-gated via `canUseDevLayoutOverlay` in [`src/lib/dev-layout/access.js`](/f:/hnpsystem/src/lib/dev-layout/access.js).
- The feature is enabled only in development-safe contexts (`NODE_ENV !== production` unless explicitly overridden).
- Overlay state and mode persist in local storage.
- When disabled, there is no interactive overlay layer.

## Sidebar Controls
The sidebar bottom area contains a 50/50 row:
- Left: `Diagnostics`
- Right: `Dev Overlay ON/OFF`

The overlay switch is in [`src/components/Sidebar.js`](/f:/hnpsystem/src/components/Sidebar.js) and uses the same ON/OFF switch pattern as floating notes controls.

## Keyboard Shortcuts
- `Ctrl + Shift + D`: toggle overlay on/off
- `Ctrl + Shift + M`: cycle mode

Implemented in [`src/context/DevLayoutOverlayContext.js`](/f:/hnpsystem/src/context/DevLayoutOverlayContext.js).

## Modes
1. `labels`
- Number markers only.

2. `details`
- Number + compact metadata (type/background token).

3. `inspect`
- Click a section to open inspector panel.
- Shows route, number, key, parent/children, type, spacing/radius/width/class data.
- Includes copy buttons for:
  - Section reference
  - Debug summary
  - Codex prompt
  - Claude prompt

## Section Numbering and Identity
Numbering is generated per rendered page tree:
- Top-level sections are numbered in visual DOM order.
- Child sections inherit hierarchical numbering.

Stable key rules:
- Use lowercase kebab-case.
- Prefix by route/page domain.
- Include semantic purpose.

Examples:
- `jobcard-header`
- `jobcard-summary-shell`
- `clocking-overview-stats`
- `workshop-dashboard-checkin-trends`

## Registering Sections in New Pages
Preferred method is explicit registration using data attributes or `DevLayoutSection`.

Minimal explicit pattern:

```jsx
<DevLayoutSection
  sectionKey="clocking-overview-stats"
  sectionType="section-shell"
  parentKey="clocking-overview-shell"
  shell
>
  ...
</DevLayoutSection>
```

Or raw attributes:

```jsx
<section
  data-dev-section="1"
  data-dev-section-key="jobcard-tab-row"
  data-dev-section-type="tab-row"
  data-dev-section-parent="jobcard-page-shell"
>
  ...
</section>
```

## Shared Layout Architecture
Reusable primitives live in [`src/components/ui/layout-system/index.js`](/f:/hnpsystem/src/components/ui/layout-system/index.js):
- `PageShell`
- `ContentWidth`
- `SectionShell`
- `StandardCard`
- `SurfaceCard`
- `AccentSurface`
- `TabRow`
- `FilterToolbarRow`
- `StatCard`
- `SectionHeaderRow`

Core style classes are defined in [`src/styles/globals.css`](/f:/hnpsystem/src/styles/globals.css) under `.app-layout-*`.

These are intended to enforce consistent:
- page shell width/start alignment
- section spacing
- card radius/padding/surfaces
- tab row + toolbar/filter row structure

## Prompt Generation
Prompt output includes:
- route
- section number
- stable key
- section type and layout metadata
- parent/child references
- inferred issue tags

This is designed for practical clean-up prompts, not generic summaries.

## Issue Tags
Current heuristic tags include:
- `extra-wrapper`
- `rogue-wrapper`
- `nonstandard-radius`
- `misaligned-start`
- `duplicate-surface`
- `accent-overuse`
- `inconsistent-gap`
- `nested-shell`
- `over-padded`
- `off-grid`

Tags are hints and should be validated visually.

## Auto Detection Fallback
When explicit keys are missing, the overlay attempts fallback detection on obvious structures (cards, tab rows, toolbars, tables, shells).

Explicit registration remains the recommended standard.

