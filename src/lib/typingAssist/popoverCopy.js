// file location: src/lib/typingAssist/popoverCopy.js
//
// The words shown in the typing assistant's suggestion popover, derived from a
// controller popover snapshot. Shared by the staff popover
// (src/components/ui/typingAssist/GlobalTypingAssist.js) and the customer one
// (src/features/website/components/WebsiteTypingAssistPopover.js) so both
// skins always say the same thing.

const KIND_LABELS = {
  misspelt: "Spelling",
  "us-spelling": "UK spelling",
};

export function describePopover(popover) {
  const { issue } = popover;
  const isSpelling = issue.kind === "spelling";
  return {
    isSpelling,
    kindLabel: isSpelling ? KIND_LABELS[issue.rule] || "Spelling" : "Grammar",
    message: issue.message,
    ariaLabel: isSpelling ? "Spelling suggestions" : "Grammar suggestion",
    suggestions: (popover.suggestions || []).map((value, index) => ({
      index,
      value,
      label: popover.labels?.[index] || (value === "" ? "Remove" : value),
      highlighted: index === popover.highlighted,
    })),
    emptyText: popover.loading ? "Finding suggestions…" : "No suggestions",
  };
}
