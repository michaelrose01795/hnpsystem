// file location: src/features/workspaces/components/WorkspaceSpacePrompt.js
//
// The small, non-modal "Extra screen space detected" offer. It never takes
// focus or blocks the page; dismissing it is remembered for this amount of
// space (see promptDismissedCapacity in the model).
import React from "react";
import Button from "@/components/ui/Button";
import SymbolButton from "@/components/ui/SymbolButton";

export default function WorkspaceSpacePrompt({ capacity, onAdd, onDismiss }) {
  const isThird = capacity >= 3;
  return (
    <section className="app-workspace-prompt" role="region" aria-label="Extra screen space detected">
      <div className="app-workspace-prompt__head">
        <p className="app-workspace-prompt__title">Extra screen space detected</p>
        <SymbolButton symbol="close" label="Dismiss" onClick={onDismiss} />
      </div>
      <p className="app-workspace-prompt__body">
        {isThird
          ? "There is room for another DMS workspace. Add a third to keep one more page open alongside."
          : "Your window is wide enough for a second DMS workspace, so you can keep another page, such as Messages, open beside this one."}
      </p>
      <div className="app-workspace-prompt__actions">
        <Button variant="primary" size="sm" symbol={false} onClick={onAdd}>
          Add workspace
        </Button>
        <Button variant="secondary" size="sm" symbol={false} onClick={onDismiss}>
          Not now
        </Button>
      </div>
    </section>
  );
}
