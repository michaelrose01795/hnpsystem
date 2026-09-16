// file location: src/features/website/components/WebsiteTypingAssistPopover.js
//
// The typing assistant's suggestion popover under the customer scope
// (html.website-scope). Rendered by src/components/ui/typingAssist/GlobalTypingAssist.js
// on /website routes; styled by `@family typing-assist` in custglobal.css.
// Rows are raw <button>s — the customer secondary control.
//
// Mouse-down is cancelled so focus, the caret and the selection stay in the
// field being corrected: the popover is operated, never focused.

import { describePopover } from "@/lib/typingAssist/popoverCopy";

export default function WebsiteTypingAssistPopover({ id, popover, controller, visible }) {
  const copy = describePopover(popover);
  return (
    <div
      id={id}
      role="dialog"
      aria-label={copy.ariaLabel}
      data-typing-assist-ui=""
      className={`website-typing-assist-popover${visible ? " is-visible" : ""}`}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="website-typing-assist-popover__head">
        <span
          className={
            copy.isSpelling
              ? "website-typing-assist-popover__kind website-typing-assist-popover__kind--spelling"
              : "website-typing-assist-popover__kind"
          }
        >
          {copy.kindLabel}
        </span>
        <span className="website-typing-assist-popover__message">{copy.message}</span>
      </div>
      {copy.suggestions.length ? (
        <div className="website-typing-assist-popover__suggestions" role="listbox" aria-label="Suggestions">
          {copy.suggestions.map((suggestion) => (
            <button
              key={`${suggestion.value}-${suggestion.index}`}
              type="button"
              role="option"
              aria-selected={suggestion.highlighted}
              className={`website-typing-assist-popover__suggestion${suggestion.highlighted ? " is-highlighted" : ""}`}
              onMouseEnter={() => controller.highlight(suggestion.index)}
              onClick={() => controller.applySuggestion(suggestion.index)}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      ) : (
        <span className="website-typing-assist-popover__empty">{copy.emptyText}</span>
      )}
      <div className="website-typing-assist-popover__actions">
        <button type="button" className="website-typing-assist-popover__action" onClick={controller.ignoreIssue}>
          Ignore
        </button>
        {copy.isSpelling ? (
          <button type="button" className="website-typing-assist-popover__action" onClick={controller.addToDictionary}>
            Add to dictionary
          </button>
        ) : null}
      </div>
    </div>
  );
}
