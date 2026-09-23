// file location: src/lib/typingAssist/spellEngine.js
//
// Spelling decisions and ranked suggestions for the typing assistant, on top
// of a Hunspell dictionary (nspell + the en-GB SCOWL dictionary in
// public/dictionaries/en-GB). Pure: the dictionary is injected, so the Web
// Worker, the main-thread fallback and the unit tests share this exactly.
//
// Why not just nspell.suggest(): its order is "edits it tried first", not
// "what you most likely meant". Suggestions here are re-ranked by true edit
// distance (transpositions count as one edit), shared first letter, word
// frequency and length, with the UK form of an American spelling and known
// common typos always placed first.

import { COMMON_MISSPELLINGS, DOMAIN_WORDS, UK_SUFFIX_RULES, US_TO_UK, matchCase } from "./ukEnglish";
import { COMMON_RANK } from "./commonWords";
import { normaliseApostrophes } from "./textTokens";

const EMPTY = new Set();
const MAX_SUGGEST_LENGTH = 24;

// Optimal-string-alignment distance: insert, delete, substitute, transpose.
export function editDistance(a, b) {
  const s = String(a);
  const t = String(b);
  const rows = s.length + 1;
  const cols = t.length + 1;
  const d = Array.from({ length: rows }, (_, i) => {
    const row = new Array(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j += 1) d[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[s.length][t.length];
}

export function createSpellEngine(dictionary, { words = [] } = {}) {
  const known = (w) => {
    try {
      return Boolean(dictionary.correct(w));
    } catch {
      return false;
    }
  };

  const completionList = [...new Set(words.filter((w) => /^[a-z][a-z']{2,}$/.test(w)))].sort();

  function inDictionary(word) {
    const w = normaliseApostrophes(word);
    if (known(w)) return true;
    const lower = w.toLowerCase();
    // "Brakes" at the start of a sentence, "BRAKES" in a heading.
    return lower !== w && (w === w.toUpperCase() || w[0] === w[0].toUpperCase()) && known(lower);
  }

  function ukVariant(word) {
    const lower = normaliseApostrophes(word).toLowerCase();
    for (const [pattern, replacement] of UK_SUFFIX_RULES) {
      if (!pattern.test(lower)) continue;
      const candidate = lower.replace(pattern, replacement);
      if (candidate !== lower && known(candidate)) return candidate;
    }
    return null;
  }

  // -> { ok: true } | { ok: false, reason: "misspelt" | "us-spelling" }
  function check(word, { personal = EMPTY, ukSpelling = true } = {}) {
    const w = normaliseApostrophes(word);
    const lower = w.toLowerCase();
    if (personal.has(lower) || DOMAIN_WORDS.has(lower)) return { ok: true };
    if (US_TO_UK[lower]) return ukSpelling ? { ok: false, reason: "us-spelling" } : { ok: true };
    if (COMMON_MISSPELLINGS[lower]) return { ok: false, reason: "misspelt" };
    if (inDictionary(w)) return { ok: true };
    const variant = ukVariant(w);
    if (variant) return ukSpelling ? { ok: false, reason: "us-spelling" } : { ok: true };
    return { ok: false, reason: "misspelt" };
  }

  function suggest(word, { ukSpelling = true, limit = 5 } = {}) {
    const original = normaliseApostrophes(word);
    const lower = original.toLowerCase();
    const shaped = (candidate) =>
      // Only ever RAISE case: "london" -> "London" keeps the capital, while
      // "Recieve" at a sentence start -> "Receive".
      candidate[0] === candidate[0].toUpperCase() && candidate[0] !== candidate[0].toLowerCase()
        ? candidate
        : matchCase(original, candidate);

    const ordered = [];
    const push = (candidate) => {
      if (!candidate) return;
      const value = shaped(candidate);
      if (value.toLowerCase() === lower && value === original) return;
      if (!ordered.some((existing) => existing.toLowerCase() === value.toLowerCase())) ordered.push(value);
    };

    if (ukSpelling) push(US_TO_UK[lower]);
    if (ukSpelling) push(ukVariant(original));
    push(COMMON_MISSPELLINGS[lower]);

    if (ordered.length < limit && original.length <= MAX_SUGGEST_LENGTH) {
      let raw = [];
      try {
        raw = dictionary.suggest(original) || [];
      } catch {
        raw = [];
      }
      const scored = raw.map((candidate, index) => {
        let c = normaliseApostrophes(candidate).toLowerCase();
        if (ukSpelling && US_TO_UK[c]) c = US_TO_UK[c];
        const rank = COMMON_RANK.get(c);
        const frequency = rank == null ? 1 : rank / COMMON_RANK.size;
        const swappedStart = c[0] === lower[1] && c[1] === lower[0];
        const firstLetter = c[0] === lower[0] || swappedStart ? 0 : 0.6;
        return {
          candidate: c === candidate.toLowerCase() ? candidate : c,
          score:
            editDistance(lower, c) +
            firstLetter +
            frequency * 0.9 +
            Math.abs(c.length - lower.length) * 0.15 +
            (c.includes(" ") ? 0.4 : 0) +
            index * 0.05,
        };
      });
      scored.sort((a, b) => a.score - b.score).forEach(({ candidate }) => push(candidate));
    }
    return ordered.slice(0, limit);
  }

  // Dictionary words starting with `prefix`, most common / shortest first.
  // The fallback for Tab completion when the predictor has nothing.
  function complete(prefix, limit = 3) {
    const p = String(prefix || "").toLowerCase();
    if (p.length < 3 || !completionList.length) return [];
    let lo = 0;
    let hi = completionList.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (completionList[mid] < p) lo = mid + 1;
      else hi = mid;
    }
    const matches = [];
    for (let i = lo; i < completionList.length && completionList[i].startsWith(p) && matches.length < 400; i += 1) {
      if (completionList[i].length > p.length) matches.push(completionList[i]);
    }
    const rankOf = (w) => (COMMON_RANK.has(w) ? COMMON_RANK.get(w) : COMMON_RANK.size + w.length);
    return matches.sort((a, b) => rankOf(a) - rankOf(b) || a.length - b.length).slice(0, limit);
  }

  return { check, suggest, complete, inDictionary };
}
