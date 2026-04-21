// file location: src/components/dev-layout-overlay/DevOverlayControlPanel.js
import React, { useMemo } from "react";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";
import styles from "@/components/dev-layout-overlay/DevOverlayControlPanel.module.css";

const MODE_OPTIONS = [
  { id: "labels", label: "Labels" },
  { id: "details", label: "Details" },
  { id: "inspect", label: "Inspect" },
];

function Switch({ on, onToggle, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`${styles.switch} ${on ? styles.switchOn : ""}`.trim()}
      onClick={onToggle}
    />
  );
}

export default function DevOverlayControlPanel() {
  const {
    canAccess,
    hydrated,
    enabled,
    toggleEnabled,
    mode,
    setMode,
    fullScreen,
    toggleFullScreen,
    legacyMarkers,
    toggleLegacyMarkers,
    categories,
    categoryFilters,
    toggleCategoryFilter,
    setAllCategoryFilters,
    resetCategoryFilters,
    panelOpen,
    setPanelOpen,
  } = useDevLayoutOverlay();

  const activeCount = useMemo(
    () => categories.reduce((total, cat) => total + (categoryFilters[cat.id] ? 1 : 0), 0),
    [categories, categoryFilters]
  );

  if (!hydrated || !canAccess) return null;

  if (!panelOpen) {
    return (
      <div className={styles.root}>
        <button
          type="button"
          className={styles.launcher}
          onClick={() => setPanelOpen(true)}
          aria-label="Open dev overlay controls"
          title="Dev overlay controls (Ctrl+Shift+P)"
        >
          <span
            className={`${styles.launcherDot} ${enabled ? styles.launcherDotActive : ""}`.trim()}
            aria-hidden="true"
          />
          Dev Overlay
        </button>
      </div>
    );
  }

  return (
    <div className={styles.root} role="dialog" aria-label="Dev overlay controls">
      <div className={styles.panel}>
        <header className={styles.panelHeader}>
          <div className={styles.headerTitle}>
            <p className={styles.kicker}>Dev Tools</p>
            <h3 className={styles.title}>Overlay controls</h3>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setPanelOpen(false)}
              aria-label="Minimise dev overlay panel"
              title="Minimise"
            >
              −
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.block}>
            <div className={styles.masterRow}>
              <label className={styles.masterLabel} htmlFor="dev-overlay-master">
                Overlay enabled
                <span className={styles.masterSub}>
                  {enabled ? "Overlay is rendering" : "Overlay is hidden"}
                </span>
              </label>
              <Switch
                on={enabled}
                onToggle={toggleEnabled}
                label="Toggle dev overlay master"
              />
            </div>
          </div>

          <div className={styles.block}>
            <div className={styles.blockHeader}>
              <p className={styles.blockTitle}>Label mode</p>
            </div>
            <div className={styles.modeRow}>
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles.modeBtn} ${mode === opt.id ? styles.modeBtnActive : ""}`.trim()}
                  onClick={() => setMode(opt.id)}
                  aria-pressed={mode === opt.id}
                  disabled={!enabled}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className={styles.blockHint}>
              Labels show short tags, details adds metadata, inspect exposes tokens and spacing.
            </p>
          </div>

          <div className={styles.block}>
            <div className={styles.blockHeader}>
              <p className={styles.blockTitle}>Options</p>
            </div>
            <div className={styles.optionRow}>
              <span>Full-screen scope</span>
              <Switch
                on={fullScreen}
                onToggle={toggleFullScreen}
                label="Toggle full-screen overlay"
              />
            </div>
            <div className={styles.optionRow}>
              <span>Dotted markers</span>
              <Switch
                on={legacyMarkers}
                onToggle={toggleLegacyMarkers}
                label="Toggle dotted legacy markers"
              />
            </div>
          </div>

          <div className={styles.block}>
            <div className={styles.categoryHeader}>
              <p className={styles.blockTitle}>
                Categories <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
                  · {activeCount}/{categories.length}
                </span>
              </p>
              <div className={styles.categoryBulkRow}>
                <button
                  type="button"
                  className={styles.bulkBtn}
                  onClick={() => setAllCategoryFilters(true)}
                  disabled={!enabled}
                >
                  All
                </button>
                <button
                  type="button"
                  className={styles.bulkBtn}
                  onClick={() => setAllCategoryFilters(false)}
                  disabled={!enabled}
                >
                  None
                </button>
                <button
                  type="button"
                  className={styles.bulkBtn}
                  onClick={resetCategoryFilters}
                  disabled={!enabled}
                  title="Reset to defaults"
                >
                  Reset
                </button>
              </div>
            </div>
            <ul className={styles.categoryList}>
              {categories.map((cat) => {
                const active = Boolean(categoryFilters[cat.id]);
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={active}
                      className={`${styles.categoryItem} ${active ? styles.categoryItemActive : ""}`.trim()}
                      onClick={() => toggleCategoryFilter(cat.id)}
                      disabled={!enabled}
                    >
                      <span
                        className={`${styles.categoryCheckbox} ${active ? styles.categoryCheckboxOn : ""}`.trim()}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                      <span
                        className={styles.categorySwatch}
                        style={{ background: cat.color }}
                        aria-hidden="true"
                      />
                      <span className={styles.categoryText}>
                        <span className={styles.categoryLabel}>{cat.label}</span>
                        {cat.description ? (
                          <span className={styles.categoryDesc}>{cat.description}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <p className={styles.footerHint}>
          Shortcuts: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> toggle overlay ·{" "}
          <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> cycle mode ·{" "}
          <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> this panel
        </p>
      </div>
    </div>
  );
}
