// file location: src/components/ui/ReactionBar.js
//
// Expanding emoji reaction control.
//
// A 44px circular trigger (the "react" smiley) that stays anchored where it is
// rendered. Pressing it grows the bar LEFTWARDS out of the trigger's left edge
// to reveal the reaction emojis — each a perfect 32px circle. The emoji set
// matches the messages thread picker (/messages) so a reaction means the same
// thing everywhere in the app.
//
// All appearance lives in the button family (.app-reaction-bar,
// .app-reaction-trigger, .app-reaction-emoji in src/styles/families/buttons.css).
//
// A user holds at most ONE reaction: picking a different emoji replaces the
// one they had, picking the same emoji clears it. Pass `selected` (an array of
// 0 or 1 emoji) to drive the bar from public.content_reactions; without it the
// component keeps that same rule in local state.
import React, { useEffect, useRef, useState } from "react";

export const REACTION_EMOJIS = ["👍", "👎", "❤️", "🔥", "😂", "😮"];

const REACTION_LABELS = {
  "👍": "Thumbs up",
  "👎": "Thumbs down",
  "❤️": "Heart",
  "🔥": "Fire",
  "😂": "Laugh",
  "😮": "Shock",
};

// Smiley "react" mark. Drawn in currentColor so it takes the button variant's
// text colour in both themes rather than a fixed emoji palette.
function ReactIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9.2" cy="10" r="1.15" fill="currentColor" />
      <circle cx="14.8" cy="10" r="1.15" fill="currentColor" />
      <path
        d="M8.4 14.2a4.3 4.3 0 0 0 7.2 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ReactionBar({
  emojis = REACTION_EMOJIS,
  selected,
  onReact,
  label = "React",
}) {
  const [open, setOpen] = useState(false);
  const [internalSelected, setInternalSelected] = useState([]);
  const containerRef = useRef(null);

  const isControlled = Array.isArray(selected);
  const activeEmojis = isControlled ? selected : internalSelected;

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (containerRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const toggleReaction = (emoji) => {
    if (!isControlled) {
      // Single-select: the new pick replaces whatever was there, and choosing
      // the current pick again clears it.
      setInternalSelected((previous) => (previous.includes(emoji) ? [] : [emoji]));
    }
    onReact?.(emoji);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`app-reaction-bar${open ? " is-open" : ""}`}
      onDoubleClick={(event) => event.stopPropagation()}
      data-dev-ignore
    >
      <div className="app-reaction-bar__options" role="group" aria-label="Reactions">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="app-btn app-btn--secondary app-reaction-emoji"
            aria-pressed={activeEmojis.includes(emoji)}
            aria-label={REACTION_LABELS[emoji] || `React with ${emoji}`}
            tabIndex={open ? 0 : -1}
            onClick={(event) => {
              event.stopPropagation();
              toggleReaction(emoji);
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="app-btn app-btn--secondary app-reaction-trigger"
        aria-expanded={open}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <ReactIcon />
      </button>
    </div>
  );
}
