// file location: src/features/workspaces/components/WorkspacePaneBar.js
//
// Header row above every visible workspace. Shows the workspace's page (or, in
// the slot that holds collapsed workspaces, a tab per workspace), and the
// controls for that workspace: page actions (swap / move / duplicate / reload /
// open in a browser tab) and close. The first visible pane also carries the
// shell-wide controls: quick layouts and Add workspace.
import React from "react";
import Button from "@/components/ui/Button";
import SymbolButton from "@/components/ui/SymbolButton";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { LAYOUT_PRESETS } from "@/features/workspaces/workspaceModel";

export default function WorkspacePaneBar({
  label,
  isFocused,
  isPrimary,
  tabs,
  activeTabId,
  onSelectTab,
  actionOptions,
  onAction,
  onClose,
  showShellControls,
  presetId,
  showPresets,
  onPreset,
  canAdd,
  onAdd,
}) {
  const showTabs = Boolean(tabs && tabs.length > 1);
  return (
    <div className={`app-workspace-bar${isFocused ? " is-focused" : ""}${showTabs ? " app-workspace-bar--tabs" : ""}`}>
      <div className="app-workspace-bar__identity">
        <span className="app-workspace-bar__focus-dot" aria-hidden="true" />
        {showTabs ? (
          <TabGroup
            items={tabs}
            value={activeTabId}
            onChange={(id) => onSelectTab(id)}
            ariaLabel="Collapsed workspaces"
            className="app-workspace-bar__tabs"
          />
        ) : (
          <p className="app-workspace-bar__title" title={label}>
            {isPrimary ? `Main · ${label}` : label}
            {isFocused && <span className="app-workspace-bar__sr-only"> (focused workspace)</span>}
          </p>
        )}
      </div>

      <div className="app-workspace-bar__controls">
        {showShellControls && showPresets && (
          <div className="app-workspace-bar__presets" role="group" aria-label="Workspace layout">
            {LAYOUT_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant={presetId === preset.id ? "primary" : "secondary"}
                size="xs"
                symbol={false}
                aria-pressed={presetId === preset.id}
                onClick={() => onPreset(preset.lead)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        )}
        {showShellControls && canAdd && (
          <Button variant="secondary" size="xs" symbol={false} onClick={onAdd}>
            Add workspace
          </Button>
        )}
        {actionOptions.length > 0 && (
          // Sized wrapper: the dropdown itself is full-width by design.
          <div className="app-workspace-bar__actions">
          <DropdownField
            size="sm"
            value=""
            placeholder="Page actions"
            ariaLabel={`Page actions for ${label}`}
            options={actionOptions}
            onValueChange={(value) => {
              if (value) onAction(value);
            }}
          />
          </div>
        )}
        {onClose && <SymbolButton symbol="close" label={`Close workspace: ${label}`} onClick={onClose} />}
      </div>
    </div>
  );
}
