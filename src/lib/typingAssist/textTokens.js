// file location: src/lib/typingAssist/textTokens.js
//
// Splits field text into the words the typing assistant checks, with their
// character offsets. Anything that is not prose is skipped whole: URLs,
// e-mail addresses, file paths, part numbers, registrations and anything else
// containing digits, and ACRONYMS / camelCase identifiers.

const LETTERS = "A-Za-z\\u00C0-\\u024F";
const WORD_RE = new RegExp(`[${LETTERS}]+(?:['’][${LETTERS}]+)*`, "g");
const CHUNK_RE = /\S+/g;
const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/;

export const MAX_CHECKED_LENGTH = 40;

// A whitespace-delimited chunk that should not be spell or grammar checked.
export function isNonProseChunk(chunk) {
  if (/[0-9_@\\/#<>{}=|~^$%*+[\]]/.test(chunk)) return true;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(chunk) || /^www\./i.test(chunk)) return true;
  const trimmed = chunk.replace(/^[("'‘“]+|[)"'’”.,;:!?]+$/g, "");
  return DOMAIN_RE.test(trimmed);
}

export function isCheckableWord(word) {
  if (!word || word.length < 2 || word.length > MAX_CHECKED_LENGTH) return false;
  if (/^[A-ZÀ-Þ'’]+$/.test(word)) return false; // ACRONYM or SHOUTING
  if (/[a-z][A-Z]/.test(word)) return false; // camelCase / iPhone / McName
  return true;
}

// Character ranges of every non-prose chunk, for the grammar rules to avoid.
export function nonProseRanges(text) {
  const ranges = [];
  for (const match of String(text || "").matchAll(CHUNK_RE)) {
    if (isNonProseChunk(match[0])) ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

export function overlapsRanges(start, end, ranges) {
  return ranges.some(([a, b]) => start < b && end > a);
}

// A chunk mixing letters and digits: a registration half, postcode, part number.
const isCodeChunk = (chunk) => Boolean(chunk) && /\d/.test(chunk) && /[A-Za-z]/.test(chunk);

// [{ word, start, end }] for every checkable word, in order.
export function tokenizeWords(text) {
  const source = String(text || "");
  const tokens = [];
  const chunks = [...source.matchAll(CHUNK_RE)];
  chunks.forEach((chunk, index) => {
    if (isNonProseChunk(chunk[0])) return;
    // "ab12 cde", "b7 4ab": a short letters-only piece beside a code is part of
    // that code, not a word — even when typed in lower case.
    if (chunk[0].length <= 3 && (isCodeChunk(chunks[index - 1]?.[0]) || isCodeChunk(chunks[index + 1]?.[0]))) return;
    for (const match of chunk[0].matchAll(WORD_RE)) {
      const word = match[0];
      if (!isCheckableWord(word)) continue;
      const start = chunk.index + match.index;
      tokens.push({ word, start, end: start + word.length });
    }
  });
  return tokens;
}

export function normaliseApostrophes(word) {
  return String(word || "").replace(/’/g, "'");
}

// The partial word immediately before the caret, and the word before that.
// Used by the predictor: "the front bra|" -> { partial: "bra", previous: "front" }.
export function wordsBeforeCaret(text, caret) {
  const before = String(text || "").slice(0, caret);
  const partialMatch = new RegExp(`[${LETTERS}'’]*$`).exec(before);
  const partial = partialMatch ? partialMatch[0] : "";
  const head = before.slice(0, before.length - partial.length);
  const chunkBefore = /(\S*)$/.exec(before)?.[1] || "";
  const previousMatch = new RegExp(`([${LETTERS}'’]+)[ \\t]+$`).exec(head);
  return {
    partial,
    previous: previousMatch ? previousMatch[1] : "",
    // True when the caret is inside something that is not prose (a URL, a
    // part number) — no prediction should be offered there.
    inNonProse: chunkBefore ? isNonProseChunk(chunkBefore) : false,
    // Characters between the previous word and the caret ("" when mid-word).
    gap: partial ? "" : /[ \t]*$/.exec(head)?.[0] || "",
  };
}
