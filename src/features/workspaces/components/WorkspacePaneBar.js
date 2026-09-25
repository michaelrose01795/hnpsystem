// file location: src/features/workspaces/components/WorkspacePaneBar.js
//
// The "window title" of a visible workspace card: the card's page name, and
// whether it is the focused card the sidebar drives. It sits in the gap between
// the topbar and the card (see .app-workspace-bar), so the card's top edge is
// exactly where the single page card's is.
//
// Pressing the name opens a floating card (the shared FilterButton card) with
// that card's options, built by WorkspaceHost (pageOptionsFor):
//   • This page    — reload, open in a new browser tab, copy link
//   • Card width   — equal / wider / widest for this card
//   • Position     — move left / right
//   • Other pages  — the collapsed pages kept in this slot
//   • Duplicate into a new card, Keep only this page, Close page
//
// Minimal on purpose: the name renders as plain text beside the focus dot, like
// the old title strip. It is a <button> for keyboard / screen-reader access
// only — do not give it a button look (see .app-workspace-bar__trigger).
import React, { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { FilterButton, FilterField } from "@/components/ui/filterAPI";

const COPIED_MS = 2000;

export default function WorkspacePaneBar({
  label,
  isFocused,
  tabs,
  activeTabId,
  onSelectTab,
  onClose,
  options = {},
}) {
  const otherTabs = tabs && tabs.length > 1 ? tabs.filter((tab) => tab.value !== activeTabId) : [];
  const {
    href,
    onReload,
    onOpenTab,
    onMoveLeft,
    onMoveRight,
    widthChoices = [],
    onWidth,
    onDuplicate,
    onKeepOnly,
  } = options;

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyLink = async () => {
    if (!href) return;
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).href);
      setCopied(true);
    } catch {
      // Clipboard blocked (permissions / insecure context): nothing to copy to.
    }
  };

  // Runs an option, then closes the card. Width choices and Copy link leave it
  // open so the result can be seen.
  const then = (close, action) => () => {
    close();
    action();
  };

  return (
    <div className={`app-workspace-bar${isFocused ? " is-focused" : ""}`}>
      <FilterButton
        title={label}
        label={`Options for ${label}`}
        showActions={false}
        className="app-workspace-bar__menu"
        triggerClassName="app-workspace-bar__trigger"
        trigger={
          <>
            <span className="app-workspace-bar__focus-dot" aria-hidden="true" />
            <span className="app-workspace-bar__title">{label}</span>
            {isFocused && (
              <span className="app-workspace-bar__sr-only"> (focused, the sidebar opens pages here)</span>
            )}
          </>
        }
      >
        {({ close }) => (
          <>
            {href && (
              <FilterField label="This page">
                <div className="app-workspace-bar__menu-row">
                  {onReload && (
                    <Button variant="secondary" symbol={false} onClick={then(close, onReload)}>
                      Reload
                    </Button>
                  )}
                  {onOpenTab && (
                    <Button variant="secondary" symbol={false} onClick={then(close, onOpenTab)}>
                      Open in new tab
                    </Button>
                  )}
                  <Button variant="secondary" symbol={false} onClick={copyLink} aria-live="polite">
                    {copied ? "Link copied" : "Copy link"}
                  </Button>
                </div>
              </FilterField>
            )}

            {widthChoices.length > 0 && (
              <FilterField label="Card width">
                <div className="app-workspace-bar__menu-row" role="group" aria-label="Card width">
                  {widthChoices.map((choice) => (
                    <Button
                      key={choice.id}
                      variant={choice.active ? "primary" : "secondary"}
                      symbol={false}
                      aria-pressed={choice.active}
                      disabled={choice.disabled}
                      title={choice.disabled ? "Not enough room for the other cards" : undefined}
                      onClick={() => onWidth(choice.share)}
                    >
                      {choice.label}
                    </Button>
                  ))}
                </div>
              </FilterField>
            )}

            {(onMoveLeft || onMoveRight) && (
              <FilterField label="Position">
                <div className="app-workspace-bar__menu-row">
                  <Button
                    variant="secondary"
                    symbol={false}
                    disabled={!onMoveLeft}
                    onClick={onMoveLeft ? then(close, onMoveLeft) : undefined}
                  >
                    Move left
                  </Button>
                  <Button
                    variant="secondary"
                    symbol={false}
                    disabled={!onMoveRight}
                    onClick={onMoveRight ? then(close, onMoveRight) : undefined}
                  >
                    Move right
                  </Button>
                </div>
              </FilterField>
            )}

            {otherTabs.length > 0 && (
              <FilterField label="Other pages in this space">
                <div className="app-workspace-bar__menu-group">
                  {otherTabs.map((tab) => (
                    <Button
                      key={tab.value}
                      variant="secondary"
                      symbol={false}
                      onClick={then(close, () => onSelectTab(tab.value))}
                    >
                      {`Show ${tab.label}`}
                    </Button>
                  ))}
                </div>
              </FilterField>
            )}

            <div className="app-workspace-bar__menu-group">
              {onDuplicate && (
                <Button variant="secondary" symbol={false} onClick={then(close, onDuplicate)}>
                  Duplicate into a new card
                </Button>
              )}
              {onKeepOnly && (
                <Button variant="secondary" symbol={false} onClick={then(close, onKeepOnly)}>
                  Keep only this page
                </Button>
              )}
              <Button variant="secondary" symbol={false} onClick={onClose}>
                Close page
              </Button>
            </div>
          </>
        )}
      </FilterButton>
    </div>
  );
}
