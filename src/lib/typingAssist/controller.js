// file location: src/lib/typingAssist/controller.js
//
// The typing assistant's brain. Framework-free: it listens to the document,
// attaches to whichever eligible field has focus — text box, search bar,
// textarea or contenteditable editor — runs the spelling, grammar and
// prediction checks, and hands a plain snapshot to `onRender`.
// src/components/ui/typingAssist/GlobalTypingAssist.js only draws snapshots.
//
// Snapshot: { skin, mode, text, issues, ghost, showHint, popover } | null
//
// Text boxes and textareas are underlined through a mirror overlay; a
// contenteditable is underlined with CSS Custom Highlights (::highlight),
// painted by this controller. Both share one field adapter (read the text,
// read the selection as offsets, replace a range).
//
// Keys, while a field has focus:
//   Tab        accept the grey predicted word
//   Esc        dismiss the prediction / close the suggestions
//   Ctrl+.     open suggestions for the underlined word at the caret
//   Up / Down  move through suggestions, Enter applies

import { typingAssistModeFor } from "./fieldEligibility";
import { checkGrammar } from "./grammarRules";
import { tokenizeWords, wordsBeforeCaret } from "./textTokens";
import { createWordPredictor } from "./wordPredictor";
import { cachedVerdict, checkWords, completionsFor, setPersonalWords, suggestionsFor, warmSpellChecker } from "./spellClient";
import {
  MODEL_KEY,
  addToPersonalDictionary,
  readLearnedModel,
  readPersonalDictionary,
  readTypingAssistSettings,
  subscribeTypingAssist,
  writeLearnedModel,
} from "./settings";
import { replaceFieldRange, syncMirrorToCaret, syncMirrorToField } from "./fieldMirror";
import { pointToOffset, rangeForOffsets, readRichText, replaceRichRange } from "./richText";

const CHECK_DELAY = 300; // ms after the last keystroke
const COMPLETION_DELAY = 120;
const POLL_INTERVAL = 400; // catches value changes made by code, and layout moves
const MAX_WORDS = 4000;
const MAX_GRAMMAR_LENGTH = 50000;
const UI_SELECTOR = "[data-typing-assist-ui]";
const WORD_CHAR = /[A-Za-zÀ-ɏ'’]/;
const MODIFIER_KEYS = ["Shift", "Control", "Alt", "Meta", "CapsLock"];
export const HIGHLIGHT_NAMES = { spelling: "typing-assist-spelling", grammar: "typing-assist-grammar" };

const SPELLING_MESSAGES = {
  misspelt: "Possible spelling mistake.",
  "us-spelling": "Use the UK English spelling.",
};

// Move issues through an edit instead of dropping them all, so underlines
// elsewhere in the text do not flicker while typing. Issues touched by the
// edit are dropped; the next check restores whatever still applies.
export function shiftIssues(issues, previous, next) {
  if (previous === next || !issues.length) return issues;
  const limit = Math.min(previous.length, next.length);
  let prefix = 0;
  while (prefix < limit && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < limit - prefix && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix += 1;
  const oldEnd = previous.length - suffix;
  const inserted = next.slice(prefix, next.length - suffix);
  const pureInsert = oldEnd === prefix;
  const delta = next.length - previous.length;
  const out = [];
  for (const issue of issues) {
    const clearBefore = issue.end < prefix || (pureInsert && issue.end === prefix && !WORD_CHAR.test(inserted[0] || ""));
    const clearAfter = issue.start > oldEnd || (pureInsert && issue.start === oldEnd && !WORD_CHAR.test(inserted[inserted.length - 1] || ""));
    if (clearBefore && !(issue.contextEnd != null && issue.contextEnd >= prefix)) out.push(issue);
    else if (clearAfter) {
      const moved = { ...issue, start: issue.start + delta, end: issue.end + delta };
      if (issue.contextEnd != null) moved.contextEnd = issue.contextEnd + delta;
      out.push(moved);
    }
  }
  return out;
}

// One interface over <input>/<textarea> and contenteditable.
function createFieldAdapter(el, mode) {
  if (mode !== "rich") {
    return {
      read: () => el.value || "",
      selection: () => ({ start: el.selectionStart, end: el.selectionEnd }),
      replace: (start, end, value) => replaceFieldRange(el, start, end, value),
      range: () => null,
      usable: () => el.isConnected && !el.disabled && !el.readOnly,
    };
  }
  let model = readRichText(el);
  return {
    read: () => {
      model = readRichText(el);
      return model.text;
    },
    selection: () => {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount || !el.contains(selection.focusNode)) return { start: null, end: null };
      const focus = pointToOffset(model, selection.focusNode, selection.focusOffset);
      const anchor = pointToOffset(model, selection.anchorNode, selection.anchorOffset);
      if (focus == null || anchor == null) return { start: null, end: null };
      return { start: Math.min(anchor, focus), end: Math.max(anchor, focus) };
    },
    replace: (start, end, value) => replaceRichRange(el, model, start, end, value),
    range: (start, end) => rangeForOffsets(model, start, end),
    usable: () => el.isConnected && el.isContentEditable,
  };
}

function highlightsSupported() {
  return typeof CSS !== "undefined" && Boolean(CSS.highlights) && typeof Highlight !== "undefined";
}

function clearHighlights() {
  if (!highlightsSupported()) return;
  Object.values(HIGHLIGHT_NAMES).forEach((name) => CSS.highlights.delete(name));
}

export function createTypingAssistController({ onRender, getMirror }) {
  let settings = readTypingAssistSettings();
  let predictor = null;
  const ignoredWords = new Set();
  const ignoredGrammar = new Set();

  let field = null;
  let adapter = null;
  let mode = null;
  let skin = "staff";
  let text = "";
  let spelling = [];
  let grammar = [];
  let ghost = null;
  let popover = null;
  let composing = false;
  let lastInputType = "";
  let skipNextGhost = false;
  let originalSpellcheck = null;
  let resizeObserver = null;
  let checkTimer = 0;
  let completionTimer = 0;
  let pollTimer = 0;
  let layoutFrame = 0;
  let checkRun = 0;
  let lastRectKey = "";
  let started = false;
  let unsubscribe = () => {};

  const typing = () => lastInputType.startsWith("insert");
  const coarseOnly = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches &&
    !window.matchMedia("(any-pointer: fine)").matches;
  const ensurePredictor = () => {
    if (!predictor && settings.predictions) predictor = createWordPredictor({ state: readLearnedModel() });
  };

  // ---------------------------------------------------------------- snapshot
  function visibleIssues() {
    if (!field) return [];
    const caret = document.activeElement === field ? adapter.selection().start : null;
    const spell = spelling.filter((issue) => !ignoredWords.has(issue.word.toLowerCase()));
    const gram = grammar.filter(
      (issue) =>
        !ignoredGrammar.has(`${issue.rule}|${issue.text}`) &&
        !spell.some((s) => issue.start < s.end && issue.end > s.start)
    );
    return [...spell, ...gram]
      .map((issue) => ({ ...issue, key: `${issue.kind}:${issue.start}:${issue.end}` }))
      .filter((issue) => {
        // Never underline the word still being typed.
        if (!typing() || caret == null || popover?.key === issue.key) return true;
        return (issue.contextEnd ?? issue.end) !== caret;
      })
      .sort((a, b) => a.start - b.start);
  }

  function paintHighlights(issues) {
    if (mode !== "rich" || !highlightsSupported()) return;
    const groups = { spelling: new Highlight(), grammar: new Highlight() };
    for (const issue of issues) {
      const range = adapter.range(issue.start, issue.end);
      if (range) groups[issue.kind === "spelling" ? "spelling" : "grammar"].add(range);
    }
    CSS.highlights.set(HIGHLIGHT_NAMES.spelling, groups.spelling);
    CSS.highlights.set(HIGHLIGHT_NAMES.grammar, groups.grammar);
  }

  function emit() {
    if (!field) {
      clearHighlights();
      onRender(null);
      return;
    }
    const issues = visibleIssues();
    paintHighlights(issues);
    onRender({ skin, mode, text, issues, ghost, showHint: Boolean(ghost) && !coarseOnly(), popover });
  }

  // ------------------------------------------------------------------ layout
  function layoutNow() {
    const mirror = getMirror?.();
    if (!field || !mirror) return;
    if (mode === "rich") {
      syncMirrorToCaret(mirror, field, ghost ? adapter.range(ghost.at, ghost.at) : null);
      return;
    }
    const rect = syncMirrorToField(mirror, field);
    lastRectKey = `${rect.left}|${rect.top}|${rect.width}|${rect.height}`;
  }

  function scheduleLayout() {
    if (layoutFrame || typeof window === "undefined") return;
    layoutFrame = window.requestAnimationFrame(() => {
      layoutFrame = 0;
      layoutNow();
    });
  }

  // The line box(es) of an issue, for the popover to hang from.
  function anchorFor(state) {
    if (!field || !state) return null;
    let rects = [];
    if (mode === "rich") {
      const range = adapter.range(state.issue.start, state.issue.end);
      rects = range ? [...range.getClientRects()] : [];
    } else {
      const mark = getMirror?.()?.querySelector(`[data-issue-key="${state.key}"]`);
      rects = mark ? [...mark.getClientRects()] : [];
    }
    if (!rects.length) return null;
    if (!state.point) return rects[0];
    const middle = (rect) => (rect.top + rect.bottom) / 2;
    return rects.reduce((best, rect) =>
      Math.abs(middle(rect) - state.point.y) < Math.abs(middle(best) - state.point.y) ? rect : best
    );
  }

  // ------------------------------------------------------------------ checks
  async function runChecks() {
    if (!field) return;
    const run = ++checkRun;
    const snapshot = text;
    grammar =
      settings.grammar && snapshot.length <= MAX_GRAMMAR_LENGTH
        ? checkGrammar(snapshot, { multiline: mode !== "single" }).map((issue) => ({
            ...issue,
            text: snapshot.slice(issue.start, issue.end),
          }))
        : [];
    if (!settings.spelling) {
      spelling = [];
      emit();
      return;
    }
    emit();
    const tokens = tokenizeWords(snapshot).slice(0, MAX_WORDS);
    let wrong = new Map();
    if (tokens.length) {
      try {
        wrong = await checkWords(tokens.map((t) => t.word), { ukSpelling: settings.ukSpelling });
      } catch {
        return; // dictionary unavailable — grammar and predictions still work
      }
    }
    if (run !== checkRun || !field || text !== snapshot) return;
    spelling = tokens
      .filter((token) => wrong.has(token.word))
      .map((token) => ({
        kind: "spelling",
        rule: wrong.get(token.word),
        start: token.start,
        end: token.end,
        word: token.word,
        text: token.word,
        message: SPELLING_MESSAGES[wrong.get(token.word)],
      }));
    emit();
    scheduleLayout();
  }

  function scheduleChecks() {
    window.clearTimeout(checkTimer);
    checkTimer = window.setTimeout(runChecks, CHECK_DELAY);
  }

  // -------------------------------------------------------------- prediction
  function updateGhost() {
    window.clearTimeout(completionTimer);
    ghost = null;
    if (skipNextGhost) {
      skipNextGhost = false;
      return;
    }
    if (!field || !settings.predictions || composing || !typing() || coarseOnly()) return;
    ensurePredictor();
    const { start: at, end } = adapter.selection();
    if (at == null || at !== end) return;
    // Only at the end of a line — a ghost cannot push real text aside.
    if (!/^[ \t ]*(\n|$)/.test(text.slice(at))) return;
    const context = wordsBeforeCaret(text.replace(/ /g, " "), at);
    if (context.inNonProse) return;

    if (context.partial) {
      if (context.partial.length > 30) return;
      const completion = predictor.completeWord(context.partial, context.previous);
      if (completion) {
        ghost = { at, text: completion.remainder };
        return;
      }
      if (!settings.spelling || context.partial.length < 4) return;
      const expected = text;
      completionTimer = window.setTimeout(async () => {
        let words = [];
        try {
          words = await completionsFor(context.partial);
        } catch {
          return;
        }
        if (!field || composing || text !== expected || adapter.selection().start !== at || !words[0]) return;
        let remainder = words[0].slice(context.partial.length);
        if (context.partial.length > 1 && context.partial === context.partial.toUpperCase()) remainder = remainder.toUpperCase();
        ghost = { at, text: remainder };
        emit();
        scheduleLayout();
      }, COMPLETION_DELAY);
      return;
    }

    if (context.gap === " " && context.previous) {
      const next = predictor.predictNext(context.previous);
      if (next) ghost = { at, text: next };
    }
  }

  function acceptGhost() {
    if (!field || !ghost) return;
    const { at, text: insert } = ghost;
    ghost = null;
    adapter.replace(at, at, insert);
  }

  // ------------------------------------------------------------- suggestions
  function issueAt(position) {
    if (position == null) return null;
    return visibleIssues().find((issue) => position >= issue.start && position <= issue.end) || null;
  }

  function openPopover(issue, point) {
    const isSpelling = issue.kind === "spelling";
    popover = {
      key: issue.key,
      issue,
      point, // { x, y } of the click, or null when opened from the keyboard
      suggestions: isSpelling ? null : issue.suggestions,
      labels: isSpelling ? null : issue.labels || null,
      loading: isSpelling,
      highlighted: point ? -1 : 0,
    };
    emit();
    if (!isSpelling) return;
    suggestionsFor(issue.word, { ukSpelling: settings.ukSpelling })
      .then((list) => list || [])
      .catch(() => [])
      .then((list) => {
        if (!popover || popover.key !== issue.key) return;
        popover = { ...popover, suggestions: list, loading: false };
        emit();
      });
  }

  function closePopover() {
    if (!popover) return;
    popover = null;
    emit();
  }

  function applySuggestion(index) {
    if (!field || !popover) return;
    const { issue, suggestions } = popover;
    const replacement = suggestions?.[index];
    popover = null;
    if (replacement == null || text.slice(issue.start, issue.end) !== issue.text) {
      emit();
      return;
    }
    skipNextGhost = true;
    adapter.replace(issue.start, issue.end, replacement);
    emit();
  }

  function highlight(index) {
    if (!popover || popover.highlighted === index) return;
    popover = { ...popover, highlighted: index };
    emit();
  }

  function ignoreIssue() {
    if (!popover) return;
    const { issue } = popover;
    if (issue.kind === "spelling") ignoredWords.add(issue.word.toLowerCase());
    else ignoredGrammar.add(`${issue.rule}|${issue.text}`);
    popover = null;
    emit();
  }

  function addToDictionary() {
    if (!popover || popover.issue.kind !== "spelling") return;
    const lower = popover.issue.word.toLowerCase();
    spelling = spelling.filter((issue) => issue.word.toLowerCase() !== lower);
    popover = null;
    emit();
    addToPersonalDictionary(lower); // broadcasts -> onSettingsChanged re-checks
  }

  // ------------------------------------------------------------ field events
  function onInput(event) {
    if (!field) return;
    const previous = text;
    text = adapter.read();
    lastInputType = event?.inputType || "insertText";
    spelling = shiftIssues(spelling, previous, text);
    grammar = shiftIssues(grammar, previous, text);
    popover = null;
    scheduleChecks();
    updateGhost();
    emit();
    scheduleLayout();
  }

  function onKeyDown(event) {
    if (!field || composing || event.isComposing) return;
    const { key } = event;
    const modifier = event.ctrlKey || event.metaKey || event.altKey;

    if (popover) {
      const count = popover.suggestions?.length || 0;
      if ((key === "ArrowDown" || key === "ArrowUp") && count) {
        event.preventDefault();
        const step = key === "ArrowDown" ? 1 : -1;
        const from = popover.highlighted < 0 ? (step > 0 ? -1 : 0) : popover.highlighted;
        highlight((from + step + count) % count);
        return;
      }
      if (key === "Enter" && count && popover.highlighted >= 0) {
        event.preventDefault();
        event.stopPropagation();
        applySuggestion(popover.highlighted);
        return;
      }
      if (key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePopover();
        return;
      }
      if (!MODIFIER_KEYS.includes(key)) closePopover();
    }

    if (ghost) {
      if (key === "Tab" && !event.shiftKey && !modifier) {
        event.preventDefault();
        event.stopPropagation();
        acceptGhost();
        return;
      }
      if (key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        ghost = null;
        emit();
        return;
      }
      if (!MODIFIER_KEYS.includes(key)) {
        ghost = null;
        emit();
      }
    }

    if (/^(Arrow|Home|End|Page)/.test(key)) {
      lastInputType = "";
      emit();
    }

    if ((event.ctrlKey || event.metaKey) && key === ".") {
      lastInputType = "";
      const issue = issueAt(adapter.selection().start);
      if (issue) {
        event.preventDefault();
        openPopover(issue, null);
      }
    }
  }

  function onClick(event) {
    if (!field) return;
    lastInputType = "";
    ghost = null;
    const { start, end } = adapter.selection();
    const issue = start != null && start === end ? issueAt(start) : null;
    if (issue) openPopover(issue, { x: event.clientX, y: event.clientY });
    else {
      popover = null;
      emit();
    }
  }

  function onCompositionStart() {
    composing = true;
    ghost = null;
    emit();
  }

  function onCompositionEnd() {
    composing = false;
    lastInputType = "insertCompositionText";
    scheduleChecks();
  }

  function poll() {
    if (!field) return;
    if (!adapter.usable()) {
      detach();
      return;
    }
    if (adapter.read() !== text) onInput({ inputType: "external" });
    if (mode === "rich") return;
    const rect = field.getBoundingClientRect();
    if (`${rect.left}|${rect.top}|${rect.width}|${rect.height}` !== lastRectKey) scheduleLayout();
  }

  // --------------------------------------------------------- attach / detach
  function learnFrom() {
    if (!predictor || !settings.learn || !settings.predictions || !text.trim()) return;
    const options = { ukSpelling: settings.ukSpelling };
    const verified = (word) =>
      [word, word[0].toUpperCase() + word.slice(1), word.toUpperCase()].some((v) => cachedVerdict(v, options) === null);
    predictor.learn(text, verified);
    writeLearnedModel(predictor.exportState());
  }

  function attach(el) {
    detach();
    field = el;
    mode = typingAssistModeFor(el);
    adapter = createFieldAdapter(el, mode);
    skin = document.documentElement.classList.contains("website-scope") ? "website" : "staff";
    originalSpellcheck = el.getAttribute("spellcheck");
    el.setAttribute("data-typing-assist-active", "");
    // The browser's own wavy underline would double up with ours.
    el.setAttribute("spellcheck", "false");
    el.addEventListener("input", onInput);
    el.addEventListener("keydown", onKeyDown, true);
    el.addEventListener("click", onClick);
    el.addEventListener("scroll", scheduleLayout);
    el.addEventListener("compositionstart", onCompositionStart);
    el.addEventListener("compositionend", onCompositionEnd);
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(scheduleLayout);
      resizeObserver.observe(el);
    }
    pollTimer = window.setInterval(poll, POLL_INTERVAL);
    text = adapter.read();
    spelling = [];
    grammar = [];
    ghost = null;
    popover = null;
    lastInputType = "";
    ensurePredictor();
    if (settings.spelling) warmSpellChecker();
    runChecks();
    scheduleLayout();
  }

  function detach() {
    if (!field) return;
    const el = field;
    learnFrom();
    window.clearTimeout(checkTimer);
    window.clearTimeout(completionTimer);
    window.clearInterval(pollTimer);
    if (layoutFrame) window.cancelAnimationFrame(layoutFrame);
    layoutFrame = 0;
    resizeObserver?.disconnect();
    resizeObserver = null;
    el.removeEventListener("input", onInput);
    el.removeEventListener("keydown", onKeyDown, true);
    el.removeEventListener("click", onClick);
    el.removeEventListener("scroll", scheduleLayout);
    el.removeEventListener("compositionstart", onCompositionStart);
    el.removeEventListener("compositionend", onCompositionEnd);
    el.removeAttribute("data-typing-assist-active");
    if (originalSpellcheck === null) el.removeAttribute("spellcheck");
    else el.setAttribute("spellcheck", originalSpellcheck);
    field = null;
    adapter = null;
    mode = null;
    spelling = [];
    grammar = [];
    ghost = null;
    popover = null;
    composing = false;
    checkRun += 1;
    emit();
  }

  // --------------------------------------------------------- document events
  function onFocusIn(event) {
    const target = event.target;
    if (!(target instanceof Element) || target === field || target.closest(UI_SELECTOR)) return;
    if (settings.enabled && typingAssistModeFor(target)) attach(target);
    else detach();
  }

  function onFocusOut(event) {
    if (event.target !== field) return;
    window.setTimeout(() => {
      if (field && document.activeElement !== field) detach();
    }, 0);
  }

  function onPointerDown(event) {
    if (!popover) return;
    const target = event.target;
    if (target instanceof Node && (field?.contains(target) || (target instanceof Element && target.closest(UI_SELECTOR)))) return;
    closePopover();
  }

  function onScroll(event) {
    if (!field) return;
    const target = event.target;
    if (popover && !(target instanceof Element && target.closest(UI_SELECTOR))) closePopover();
    scheduleLayout();
  }

  function onSettingsChanged(key) {
    settings = readTypingAssistSettings();
    setPersonalWords(readPersonalDictionary());
    if (key === MODEL_KEY) predictor = null;
    if (!settings.enabled) {
      detach();
      return;
    }
    if (!field) {
      const active = document.activeElement;
      if (active && typingAssistModeFor(active)) attach(active);
      return;
    }
    ensurePredictor();
    if (!settings.predictions) ghost = null;
    runChecks();
  }

  function start() {
    if (started || typeof document === "undefined") return;
    started = true;
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", scheduleLayout);
    unsubscribe = subscribeTypingAssist(onSettingsChanged);
    setPersonalWords(readPersonalDictionary());
    if (settings.enabled && document.activeElement && typingAssistModeFor(document.activeElement)) {
      attach(document.activeElement);
    }
  }

  function stop() {
    if (!started) return;
    detach();
    started = false;
    document.removeEventListener("focusin", onFocusIn, true);
    document.removeEventListener("focusout", onFocusOut, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", scheduleLayout);
    unsubscribe();
  }

  return {
    start,
    stop,
    detach,
    layoutNow,
    anchorFor,
    applySuggestion,
    highlight,
    ignoreIssue,
    addToDictionary,
    closePopover,
  };
}
