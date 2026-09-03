// file location: src/components/ui/ReactionSummary.js
//
// Read-only breakdown of who reacted to something, in the Facebook shape:
//
//   [👍❤️😂]  12 reactions        <- overlapping stack, click for everyone
//   [👍 7] [❤️ 3] [😂 2]          <- click one for just that reaction
//   Sam Withers                👍
//   Priya Shah                 ❤️
//
// Takes a flat list of { userId, name, emoji } so the caller can feed it from
// page state today and a reactions table later without changing this file.
// Appearance lives in the reaction rules of src/styles/families/buttons.css.
import React, { useMemo, useState } from "react";

export default function ReactionSummary({
  reactions = [],
  emptyLabel = "No reactions yet.",
}) {
  // null = show everyone; an emoji = show only that reaction's people.
  const [activeEmoji, setActiveEmoji] = useState(null);
  const [listOpen, setListOpen] = useState(false);

  // Most-reacted first, so the stack shows the reactions that dominate.
  const orderedCounts = useMemo(() => {
    const counts = new Map();
    for (const reaction of reactions) {
      counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [reactions]);

  const people = useMemo(
    () =>
      activeEmoji
        ? reactions.filter((reaction) => reaction.emoji === activeEmoji)
        : reactions,
    [reactions, activeEmoji]
  );

  if (!reactions.length) {
    return <p className="app-reaction-summary__empty">{emptyLabel}</p>;
  }

  const total = reactions.length;
  const stacked = orderedCounts.slice(0, 3);
  const overflow = total - (orderedCounts[0]?.[1] || 0);

  const openList = (emoji) => {
    // Clicking the reaction you are already filtered to closes the list again.
    if (listOpen && activeEmoji === emoji) {
      setListOpen(false);
      return;
    }
    setActiveEmoji(emoji);
    setListOpen(true);
  };

  return (
    <div className="app-reaction-summary">
      <button
        type="button"
        className="app-reaction-summary__total"
        aria-expanded={listOpen && activeEmoji === null}
        onClick={() => openList(null)}
      >
        <span className="app-reaction-stack" aria-hidden="true">
          {stacked.map(([emoji]) => (
            <span key={emoji} className="app-reaction-stack__item">
              {emoji}
            </span>
          ))}
        </span>
        <span>
          {total} reaction{total === 1 ? "" : "s"}
          {overflow > 0 && orderedCounts.length > 1 ? ` · +${overflow}` : ""}
        </span>
      </button>

      <div className="app-reaction-summary__chips">
        {orderedCounts.map(([emoji, count]) => (
          <button
            key={emoji}
            type="button"
            className="app-btn app-btn--secondary app-reaction-action"
            aria-pressed={listOpen && activeEmoji === emoji}
            onClick={() => openList(emoji)}
          >
            <span>{emoji}</span>
            <span>{count}</span>
          </button>
        ))}
      </div>

      {listOpen && (
        <ul className="app-reaction-people">
          {people.map((reaction, index) => (
            <li
              key={`${reaction.userId ?? "user"}-${reaction.emoji}-${index}`}
              className="app-reaction-people__row"
            >
              <span>{reaction.name || "Unknown"}</span>
              <span>{reaction.emoji}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
