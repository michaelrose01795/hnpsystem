// file location: src/components/ui/typingAssist/GlobalTypingAssist.js
//
// Global typing assistant: UK English spelling (red underline), grammar and
// punctuation (blue underline), Tab-to-accept word prediction, and a popover
// of corrections when an underlined word is clicked — on every prose text box
// and textarea in the staff app and on /website.
//
// Mounted once from _app.js. It needs no wiring in any page: the controller
// (src/lib/typingAssist/controller.js) follows focus through the document and
// decides per field whether to attach (src/lib/typingAssist/fieldEligibility.js).
// This component only draws the controller's snapshots:
//   - a transparent mirror laid exactly over the focused field, holding the
//     underlines and the ghost word (it never takes pointer events), and
//   - the suggestion popover under the clicked word.
//
// Settings: staff /profile -> Typing, customers /website/profile -> Settings.
// Opt a field out with data-typing-assist="off".

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import WebsiteTypingAssistPopover from "@/features/website/components/WebsiteTypingAssistPopover";
import { createTypingAssistController } from "@/lib/typingAssist/controller";
import { buildMirrorSegments } from "@/lib/typingAssist/fieldMirror";
import { describePopover } from "@/lib/typingAssist/popoverCopy";
import { TYPING_ASSIST_ACTIVE, TYPING_ASSIST_SKINS } from "./skins";

const POPOVER_ID = "typing-assist-popover";
const VIEWPORT_PAD = 8;
const ANCHOR_GAP = 6;

function StaffPopover({ popover, controller, visible }) {
  const copy = describePopover(popover);
  return (
    <LayerSurface
      id={POPOVER_ID}
      role="dialog"
      aria-label={copy.ariaLabel}
      data-typing-assist-ui=""
      className={`app-typing-assist-popover${visible ? " is-visible" : ""}`}
      radius="var(--control-menu-radius)"
      padding="10px"
      gap="10px"
      // Mouse-down is cancelled so focus, the caret and the selection stay in
      // the field being corrected — the popover is operated, never focused.
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="app-typing-assist-popover__head">
        <span
          className={
            copy.isSpelling
              ? "app-typing-assist-popover__kind app-typing-assist-popover__kind--spelling"
              : "app-typing-assist-popover__kind"
          }
        >
          {copy.kindLabel}
        </span>
        <span className="app-typing-assist-popover__message">{copy.message}</span>
      </div>
      {copy.suggestions.length ? (
        <div className="app-typing-assist-popover__suggestions" role="listbox" aria-label="Suggestions">
          {copy.suggestions.map((suggestion) => (
            <button
              key={`${suggestion.value}-${suggestion.index}`}
              type="button"
              role="option"
              aria-selected={suggestion.highlighted}
              className={`app-btn app-btn--secondary app-typing-assist-popover__suggestion${suggestion.highlighted ? " is-highlighted" : ""}`}
              onMouseEnter={() => controller.highlight(suggestion.index)}
              onClick={() => controller.applySuggestion(suggestion.index)}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      ) : (
        <span className="app-typing-assist-popover__empty">{copy.emptyText}</span>
      )}
      <div className="app-typing-assist-popover__actions">
        <button type="button" className="app-btn app-btn--secondary app-typing-assist-popover__action" onClick={controller.ignoreIssue}>
          Ignore
        </button>
        {copy.isSpelling ? (
          <button type="button" className="app-btn app-btn--secondary app-typing-assist-popover__action" onClick={controller.addToDictionary}>
            Add to dictionary
          </button>
        ) : null}
      </div>
    </LayerSurface>
  );
}

export default function GlobalTypingAssist() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(null);
  const [placedKey, setPlacedKey] = useState(null);
  const controllerRef = useRef(null);
  const mirrorRef = useRef(null);

  useEffect(() => {
    const controller = createTypingAssistController({
      onRender: setSnapshot,
      getMirror: () => mirrorRef.current,
    });
    controllerRef.current = controller;
    controller.start();
    return () => controller.stop();
  }, []);

  useEffect(() => {
    if (!router.events) return undefined;
    const detach = () => controllerRef.current?.detach();
    router.events.on("routeChangeStart", detach);
    return () => router.events.off("routeChangeStart", detach);
  }, [router.events]);

  // Re-lay the mirror over the field after every content change, in the same
  // frame, so the underlines never trail the text.
  useLayoutEffect(() => {
    if (snapshot) controllerRef.current?.layoutNow();
  }, [snapshot]);

  const popover = snapshot?.popover || null;
  const popoverKey = popover ? `${popover.key}|${popover.loading ? "loading" : popover.suggestions?.length}` : null;

  // Hang the popover under the word, flipping above it when there is no room
  // below, clamped into the viewport.
  useLayoutEffect(() => {
    if (!popover) {
      setPlacedKey(null);
      return;
    }
    const panel = document.getElementById(POPOVER_ID);
    if (!panel) return;
    const anchor = controllerRef.current?.anchorFor(popover);
    if (!anchor) {
      controllerRef.current?.closePopover();
      return;
    }
    const { width, height } = panel.getBoundingClientRect();
    let top = anchor.bottom + ANCHOR_GAP;
    if (top + height > window.innerHeight - VIEWPORT_PAD) {
      top = Math.max(VIEWPORT_PAD, anchor.top - ANCHOR_GAP - height);
    }
    const left = Math.max(VIEWPORT_PAD, Math.min(anchor.left, window.innerWidth - width - VIEWPORT_PAD));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    setPlacedKey(popoverKey);
  }, [popover, popoverKey]);

  if (!snapshot || typeof document === "undefined") return null;

  const website = snapshot.skin === "website";
  const skin = website ? TYPING_ASSIST_SKINS.website : TYPING_ASSIST_SKINS.staff;
  const controller = controllerRef.current;
  // A contenteditable is underlined with CSS Highlights by the controller, so
  // its mirror only carries the ghost word at the caret.
  const segments =
    snapshot.mode === "rich"
      ? snapshot.ghost
        ? [{ type: "ghost", text: snapshot.ghost.text }]
        : []
      : buildMirrorSegments(snapshot.text, snapshot.issues, snapshot.ghost);
  const visible = Boolean(popover) && placedKey === popoverKey;

  return createPortal(
    <>
      <div ref={mirrorRef} className={skin.overlay} aria-hidden="true" data-typing-assist-ui="">
        {segments.map((segment, index) => {
          if (segment.type === "text") return <Fragment key={index}>{segment.text}</Fragment>;
          if (segment.type === "ghost") {
            return (
              <Fragment key={index}>
                <span className={skin.ghost}>{segment.text}</span>
                {snapshot.showHint ? <kbd className={skin.hint}>Tab</kbd> : null}
              </Fragment>
            );
          }
          const { issue } = segment;
          const base = issue.kind === "spelling" ? skin.markSpelling : skin.markGrammar;
          return (
            <span
              key={index}
              data-issue-key={issue.key}
              className={popover?.key === issue.key ? `${base} ${TYPING_ASSIST_ACTIVE}` : base}
            >
              {segment.text}
            </span>
          );
        })}
      </div>
      {popover && controller ? (
        website ? (
          <WebsiteTypingAssistPopover id={POPOVER_ID} popover={popover} controller={controller} visible={visible} />
        ) : (
          <StaffPopover popover={popover} controller={controller} visible={visible} />
        )
      ) : null}
    </>,
    document.body
  );
}
