// file location: src/lib/typingAssist/fieldMirror.js
//
// DOM helpers for the typing assistant's mirror overlay: keep a transparent
// copy of a text field laid exactly over it, decide whether the field is
// actually visible, and replace a range of the field's text in a way React
// controlled inputs and the browser's undo stack both accept.
//
// buildMirrorSegments is pure (no DOM) and unit tested.

const COPIED_PROPERTIES = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "fontStretch",
  "fontFeatureSettings",
  "fontVariationSettings",
  "fontKerning",
  "letterSpacing",
  "wordSpacing",
  "textTransform",
  "textIndent",
  "textAlign",
  "direction",
  "tabSize",
  "textRendering",
  "wordBreak",
];

const px = (value) => parseFloat(value) || 0;

// The part of the field not clipped by a scrolling ancestor or the viewport,
// as insets from the field's own edges. null when nothing is visible.
function visibleClip(field, rect) {
  let top = rect.top;
  let left = rect.left;
  let right = rect.right;
  let bottom = rect.bottom;
  let depth = 0;
  for (let node = field.parentElement; node && node !== document.body && depth < 30; node = node.parentElement) {
    depth += 1;
    const style = window.getComputedStyle(node);
    if (!/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) continue;
    const bounds = node.getBoundingClientRect();
    top = Math.max(top, bounds.top);
    left = Math.max(left, bounds.left);
    right = Math.min(right, bounds.right);
    bottom = Math.min(bottom, bounds.bottom);
  }
  top = Math.max(top, 0);
  left = Math.max(left, 0);
  right = Math.min(right, window.innerWidth);
  bottom = Math.min(bottom, window.innerHeight);
  if (bottom - top < 2 || right - left < 2) return null;
  return { top: top - rect.top, left: left - rect.left, right: rect.right - right, bottom: rect.bottom - bottom };
}

// True when something else (a dropdown, a modal, a toast) is painted over
// every sampled point of the field.
function isOccluded(field, rect, clip) {
  const x1 = rect.left + clip.left + 6;
  const x2 = rect.right - clip.right - 6;
  const y1 = rect.top + clip.top + 6;
  const y2 = rect.bottom - clip.bottom - 6;
  const points = [
    [x1, y1],
    [(x1 + x2) / 2, (y1 + y2) / 2],
    [x2, y2],
  ];
  return points.every(([x, y]) => {
    const hit = document.elementFromPoint(x, y);
    if (!hit || hit === field || field.contains(hit) || hit.contains(field)) return false;
    return !hit.closest("[data-typing-assist-ui]");
  });
}

// Copy the field's box and text metrics onto the mirror. Returns the field rect.
export function syncMirrorToField(mirror, field) {
  const style = window.getComputedStyle(field);
  const rect = field.getBoundingClientRect();
  const multiline = field.tagName === "TEXTAREA";
  const contentWidth = Math.max(0, field.clientWidth - px(style.paddingLeft) - px(style.paddingRight));
  const contentHeight = Math.max(0, field.clientHeight - px(style.paddingTop) - px(style.paddingBottom));
  const padLeft = px(style.borderLeftWidth) + px(style.paddingLeft);
  const padTop = px(style.borderTopWidth) + px(style.paddingTop);
  const target = mirror.style;

  target.left = `${rect.left}px`;
  target.top = `${rect.top}px`;
  target.width = `${contentWidth}px`;
  target.height = `${contentHeight}px`;
  target.paddingLeft = `${padLeft}px`;
  target.paddingTop = `${padTop}px`;
  target.paddingRight = `${Math.max(0, rect.width - padLeft - contentWidth)}px`;
  target.paddingBottom = `${Math.max(0, rect.height - padTop - contentHeight)}px`;
  for (const property of COPIED_PROPERTIES) target[property] = style[property];
  // A single-line input centres its line vertically in the content box.
  target.lineHeight = multiline ? style.lineHeight : `${contentHeight}px`;
  target.whiteSpace = multiline ? "pre-wrap" : "pre";
  target.overflowWrap = multiline ? "break-word" : "normal";

  const clip = visibleClip(field, rect);
  const hidden = !clip || isOccluded(field, rect, clip);
  target.visibility = hidden ? "hidden" : "visible";
  if (clip) target.clipPath = `inset(${clip.top}px ${clip.right}px ${clip.bottom}px ${clip.left}px)`;

  mirror.scrollTop = field.scrollTop;
  mirror.scrollLeft = field.scrollLeft;
  return rect;
}

// Contenteditable editors have no box to mirror — underlines are painted with
// CSS Custom Highlights instead. The mirror then only carries the ghost word,
// placed at the caret in the font of the text around it.
export function syncMirrorToCaret(mirror, host, range) {
  const target = mirror.style;
  let rect = range ? range.getBoundingClientRect() : null;
  if (range && (!rect || !rect.height)) rect = range.getClientRects()[0] || null;
  if (!rect || !rect.height) {
    target.visibility = "hidden";
    return;
  }
  const node = range.startContainer;
  const container = node.nodeType === 3 ? node.parentElement : node;
  const style = window.getComputedStyle(container || host);
  target.left = `${rect.right}px`;
  target.top = `${rect.top}px`;
  target.width = "auto";
  target.height = `${rect.height}px`;
  target.paddingLeft = "0px";
  target.paddingTop = "0px";
  target.paddingRight = "0px";
  target.paddingBottom = "0px";
  for (const property of COPIED_PROPERTIES) target[property] = style[property];
  target.textIndent = "0px";
  target.lineHeight = `${rect.height}px`;
  target.whiteSpace = "pre";
  target.overflowWrap = "normal";
  target.clipPath = "none";
  target.visibility = "visible";
}

// Text split into plain runs, marked issues and the ghost word, in order.
//   [{ type: "text", text }, { type: "mark", text, issue }, { type: "ghost", text }]
export function buildMirrorSegments(text, issues, ghost) {
  const source = String(text || "");
  const sorted = [...(issues || [])].sort((a, b) => a.start - b.start);
  const insideMark = (at) => sorted.some((issue) => at > issue.start && at < issue.end);
  let ghostAt = ghost && ghost.text && !insideMark(ghost.at) ? ghost.at : null;
  const segments = [];

  const pushPlain = (from, to) => {
    let start = from;
    if (ghostAt != null && ghostAt >= from && ghostAt <= to) {
      const at = ghostAt;
      ghostAt = null;
      if (at > start) segments.push({ type: "text", text: source.slice(start, at) });
      segments.push({ type: "ghost", text: ghost.text });
      start = at;
    }
    if (to > start) segments.push({ type: "text", text: source.slice(start, to) });
  };

  let cursor = 0;
  for (const issue of sorted) {
    if (issue.start < cursor || issue.end > source.length) continue;
    pushPlain(cursor, issue.start);
    segments.push({ type: "mark", text: source.slice(issue.start, issue.end), issue });
    cursor = issue.end;
  }
  pushPlain(cursor, source.length);
  // A trailing newline has no height of its own in a pre-wrap block.
  if (!source || source.endsWith("\n")) segments.push({ type: "text", text: "​" });
  return segments;
}

// Replace field text [start, end) with `replacement`, as if typed: keeps the
// browser undo stack where execCommand is available, and always leaves the
// field with the right value and a real `input` event React will see.
export function replaceFieldRange(field, start, end, replacement) {
  const before = field.value;
  const expected = before.slice(0, start) + replacement + before.slice(end);
  field.focus({ preventScroll: true });
  try {
    field.setSelectionRange(start, end);
  } catch {
    /* some input types do not support selection */
  }
  let done = false;
  try {
    done = document.execCommand("insertText", false, replacement);
  } catch {
    done = false;
  }
  if (done && field.value === expected) return;

  const proto = field.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(field, expected);
  else field.value = expected;
  const caret = start + replacement.length;
  try {
    field.setSelectionRange(caret, caret);
  } catch {
    /* ignore */
  }
  field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: replacement }));
}
