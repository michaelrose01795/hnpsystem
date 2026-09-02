// file location: src/components/NewsFeed/MentionTextarea.js
//
// A plain textarea with @mention autocomplete.
//
// Typing "@" followed by at least one character opens a staff picker; choosing
// somebody splices a @[Display Name](u:123) token into the text at the caret.
// The token is what the server indexes (src/lib/database/newsFeed/mentions.js)
// and what NewsBodyText renders as a highlighted mention.
//
// Deliberately built on a raw <textarea class="app-input"> — the shared
// InputField wraps a single-line input, and there is no shared multi-line
// primitive to extend without changing it for every other consumer.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NewsAvatar from "./NewsAvatar";
import { buildMentionToken } from "@/lib/news/format";
import { searchPeople } from "@/lib/api/news";
import { logFailure } from "@/lib/utils/logFailure";

// Matches an in-progress "@qu" immediately before the caret, and only when it
// starts a word — so an email address never opens the picker.
const TRIGGER_PATTERN = /(?:^|\s)@([\p{L}\p{N}'\-. ]{1,40})$/u;

export default function MentionTextarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 6,
  disabled = false,
  ariaLabel,
}) {
  const textareaRef = useRef(null);
  const [query, setQuery] = useState(null);
  const [people, setPeople] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const isOpen = query !== null && people.length > 0;

  // Look up staff as the query settles. A short debounce keeps this to one
  // request per pause rather than one per keystroke.
  useEffect(() => {
    if (query === null) {
      setPeople([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await searchPeople(query);
        if (!cancelled) {
          setPeople(Array.isArray(results) ? results : []);
          setActiveIndex(0);
        }
      } catch (error) {
        logFailure("Failed to load staff for @mention:", error);
        if (!cancelled) setPeople([]);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleChange = useCallback(
    (event) => {
      const nextValue = event.target.value;
      onChange?.(nextValue);

      const caret = event.target.selectionStart ?? nextValue.length;
      const match = TRIGGER_PATTERN.exec(nextValue.slice(0, caret));
      setQuery(match ? match[1].trim() : null);
    },
    [onChange]
  );

  const insertMention = useCallback(
    (person) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const caret = textarea.selectionStart ?? value.length;
      const before = value.slice(0, caret);
      const after = value.slice(caret);
      const match = TRIGGER_PATTERN.exec(before);
      if (!match) return;

      // Replace the partially-typed "@qu" with the finished token.
      const start = before.length - match[0].length + (match[0].startsWith("@") ? 0 : 1);
      const token = `${buildMentionToken(person.name, person.userId)} `;
      const next = `${value.slice(0, start)}${token}${after}`;

      onChange?.(next);
      setQuery(null);
      setPeople([]);

      // Put the caret after the inserted token on the next paint.
      window.requestAnimationFrame(() => {
        const position = start + token.length;
        textarea.focus();
        textarea.setSelectionRange(position, position);
      });
    },
    [onChange, value]
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (!isOpen) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % people.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + people.length) % people.length);
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertMention(people[activeIndex]);
      } else if (event.key === "Escape") {
        setQuery(null);
      }
    },
    [activeIndex, insertMention, isOpen, people]
  );

  const menu = useMemo(
    () =>
      isOpen ? (
        <div className="app-news-mention-menu" role="listbox" aria-label="Mention a colleague">
          {/* A listbox option, not a button: the textarea keeps the focus and
              drives the list with the arrow keys, so a focusable control here
              would fight it. Pointer users get the same result via onClick. */}
          {people.map((person, index) => (
            <div
              key={person.userId}
              role="option"
              aria-selected={index === activeIndex}
              className={`app-news-mention-menu__item${index === activeIndex ? " is-active" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertMention(person)}
            >
              <NewsAvatar user={person} size="sm" />
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span>{person.name}</span>
                {person.jobTitle && (
                  <span className="app-news-composer__hint">{person.jobTitle}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      ) : null,
    [activeIndex, insertMention, isOpen, people]
  );

  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <textarea
        id={id}
        ref={textareaRef}
        className="app-input"
        rows={rows}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setQuery(null)}
      />
      {menu}
    </div>
  );
}
