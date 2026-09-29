// file location: src/features/workspaces/components/WorkspaceSpacePrompt.js
//
// The small, non-modal "Extra screen space detected" offer. It never takes
// focus or blocks the page; dismissing it is remembered for this amount of
// space (see promptDismissedCapacity in the model). The same mode is always
// available by hand from the right-click menu (Multi workspace).
import React from "react";
import Button from "@/components/ui/Button";
import SymbolButton from "@/components/ui/SymbolButton";

export default function WorkspaceSpacePrompt({ active, onAdd, onDismiss }) {
  return (
    <section className="app-workspace-prompt" role="region" aria-label="Extra screen space detected">
      <div className="app-workspace-prompt__head">
        <p className="app-workspace-prompt__title">Extra screen space detected</p>
        <SymbolButton symbol="close" label="Dismiss" onClick={onDismiss} />
      </div>
      <p className="app-workspace-prompt__body">
        {active
          ? "There is room for a third page card. Add one to keep another page open alongside these."
          : "Your window is wide enough to show two pages side by side, each in its own card, such as Messages beside a job card. You can also turn this on any time from the right-click menu."}
      </p>
      <div className="app-workspace-prompt__actions">
        <Button variant="primary" size="sm" symbol={false} onClick={onAdd}>
          {active ? "Add a card" : "Open multi workspace"}
        </Button>
        <Button variant="secondary" size="sm" symbol={false} onClick={onDismiss}>
          Not now
        </Button>
      </div>
    </section>
  );
}
