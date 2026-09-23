// file location: src/lib/typingAssist/richText.js
//
// Plain-text view of a contenteditable editor (the notes widget, rich message
// boxes) for the typing assistant. Text boxes expose `.value` and selection
// offsets; a contenteditable exposes a DOM tree. This flattens the tree into
// one string — block elements and <br> become "\n" so words and sentences do
// not run together — and maps string offsets back to DOM Ranges, so the same
// spelling / grammar / prediction logic works on both.

const BLOCK_TAGS = new Set([
  "DIV", "P", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6",
  "BLOCKQUOTE", "PRE", "TR", "TABLE", "SECTION", "ARTICLE", "HEADER", "FOOTER",
]);

// -> { text, entries: [{ node: Text, start }] }
export function readRichText(host) {
  let text = "";
  const entries = [];
  const newline = () => {
    if (text && !text.endsWith("\n")) text += "\n";
  };
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        entries.push({ node: child, start: text.length });
        text += child.data;
      } else if (child.nodeType === 1) {
        if (child.getAttribute("contenteditable") === "false") continue;
        if (child.tagName === "BR") {
          text += "\n";
          continue;
        }
        const block = BLOCK_TAGS.has(child.tagName);
        if (block) newline();
        walk(child);
        if (block) newline();
      }
    }
  };
  walk(host);
  return { text, entries };
}

// DOM point -> string offset.
export function pointToOffset(model, node, offset) {
  if (!node) return null;
  if (node.nodeType === 3) {
    const entry = model.entries.find((e) => e.node === node);
    return entry ? entry.start + offset : null;
  }
  const child = node.childNodes[offset];
  if (child) {
    const after = model.entries.find((e) => child === e.node || child.contains(e.node));
    if (after) return after.start;
  }
  const inside = model.entries.filter((e) => node.contains(e.node));
  const last = inside[inside.length - 1];
  return last ? last.start + last.node.data.length : model.text.length;
}

// String offset -> DOM point. At the seam between two text nodes, a range
// START belongs to the later node and an END (or caret) to the earlier one.
function offsetToPoint(model, offset, preferEarlier) {
  let chosen = null;
  for (const entry of model.entries) {
    const end = entry.start + entry.node.data.length;
    if (offset < entry.start) break;
    if (offset <= end) {
      chosen = entry;
      if (preferEarlier || offset < end) break;
    }
  }
  return chosen ? { node: chosen.node, offset: offset - chosen.start } : null;
}

export function rangeForOffsets(model, start, end) {
  const from = offsetToPoint(model, start, start === end);
  const to = start === end ? from : offsetToPoint(model, end, true);
  if (!from || !to) return null;
  const range = document.createRange();
  try {
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
  } catch {
    return null;
  }
  return range;
}

// Replace [start, end) as if typed: execCommand keeps the editor's undo stack
// and fires a real `input` event; the DOM fallback does the same by hand.
export function replaceRichRange(host, model, start, end, replacement) {
  const range = rangeForOffsets(model, start, end);
  if (!range) return;
  host.focus({ preventScroll: true });
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  let done = false;
  try {
    done = document.execCommand("insertText", false, replacement);
  } catch {
    done = false;
  }
  if (done) return;
  range.deleteContents();
  if (replacement) {
    const node = document.createTextNode(replacement);
    range.insertNode(node);
    selection.collapse(node, replacement.length);
  }
  host.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: replacement }));
}
