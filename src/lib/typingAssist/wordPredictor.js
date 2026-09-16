// file location: src/lib/typingAssist/wordPredictor.js
//
// Next-word and word-completion predictions for the typing assistant — the
// grey "ghost" word accepted with Tab.
//
// A small n-gram model: word frequencies (unigrams) and word-pair counts
// (bigrams). It starts from the seed in commonWords.js and learns from what
// the person types (words the spell checker accepts only, so a typo is never
// learned and then offered back). The learned part is exported/imported as
// plain JSON so it can live in localStorage.

import { COMMON_WORDS, SEED_PHRASES } from "./commonWords";

const WORD_RE = /[a-z]+(?:'[a-z]+)*/g;
const MAX_LEARNED_WORDS = 4000;
const MAX_LEARNED_PAIRS = 1500;
const MAX_NEXT_PER_WORD = 8;
const LEARNED_WEIGHT = 0.5;
const PAIR_WEIGHT = 1.5;
const SEED_PAIR_COUNT = 2;
const MAX_COUNT = 60;

function bump(map, key, by = 1) {
  map.set(key, Math.min(MAX_COUNT, (map.get(key) || 0) + by));
}

function lowerWords(text) {
  return String(text || "").toLowerCase().replace(/’/g, "'").match(WORD_RE) || [];
}

export function createWordPredictor({ state = null } = {}) {
  const seedRank = new Map(COMMON_WORDS.map((word, index) => [word, index]));
  const seedPairs = new Map();
  const learned = new Map();
  const pairs = new Map();
  let sortedWords = null;

  for (const phrase of SEED_PHRASES) {
    const words = lowerWords(phrase);
    for (let i = 1; i < words.length; i += 1) {
      if (!seedPairs.has(words[i - 1])) seedPairs.set(words[i - 1], new Map());
      bump(seedPairs.get(words[i - 1]), words[i], SEED_PAIR_COUNT);
      if (!seedRank.has(words[i])) seedRank.set(words[i], seedRank.size);
    }
  }

  const unigram = (word) => {
    const rank = seedRank.get(word);
    const seed = rank == null ? 0 : 1 - rank / (seedRank.size + 1);
    return seed + (learned.get(word) || 0) * LEARNED_WEIGHT;
  };

  const pairCount = (previous, next) =>
    (seedPairs.get(previous)?.get(next) || 0) + (pairs.get(previous)?.get(next) || 0);

  const words = () => {
    if (!sortedWords) sortedWords = [...new Set([...seedRank.keys(), ...learned.keys()])].sort();
    return sortedWords;
  };

  // Every known word starting with `prefix`, via binary search.
  function withPrefix(prefix) {
    const list = words();
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid] < prefix) lo = mid + 1;
      else hi = mid;
    }
    const out = [];
    for (let i = lo; i < list.length && list[i].startsWith(prefix); i += 1) out.push(list[i]);
    return out;
  }

  // "bra" after "front" -> "brake". Returns { word, remainder } or null.
  function completeWord(partial, previous = "") {
    const prefix = String(partial || "").toLowerCase().replace(/’/g, "'");
    if (prefix.length < 2) return null;
    const prev = String(previous || "").toLowerCase();
    let best = null;
    for (const candidate of withPrefix(prefix)) {
      if (candidate.length <= prefix.length) continue;
      const score = unigram(candidate) + pairCount(prev, candidate) * PAIR_WEIGHT;
      if (!best || score > best.score) best = { word: candidate, score };
    }
    if (!best) return null;
    // Typed a complete, common word already ("car" should not become "card").
    const exact = unigram(prefix) + pairCount(prev, prefix) * PAIR_WEIGHT;
    if (exact > 0 && exact >= best.score * 0.75) return null;
    // Two letters is a thin clue — only complete to a very likely word.
    if (prefix.length === 2 && pairCount(prev, best.word) === 0 && best.score < 0.9) return null;

    let remainder = best.word.slice(prefix.length);
    if (partial.length > 1 && partial === partial.toUpperCase()) remainder = remainder.toUpperCase();
    return { word: partial + remainder, remainder };
  }

  // "kind " -> "regards". Returns the word or null when not confident.
  function predictNext(previous) {
    const prev = String(previous || "").toLowerCase().replace(/’/g, "'");
    if (!prev) return null;
    const merged = new Map();
    for (const source of [seedPairs.get(prev), pairs.get(prev)]) {
      if (!source) continue;
      for (const [next, count] of source) merged.set(next, (merged.get(next) || 0) + count);
    }
    let total = 0;
    let best = null;
    for (const [next, count] of merged) {
      total += count;
      if (!best || count > best.count) best = { next, count };
    }
    if (!best || best.count < 2 || best.count / total < 0.35) return null;
    return best.next;
  }

  // Learn from finished text. `isAcceptable(word)` filters out misspellings.
  function learn(text, isAcceptable = () => true) {
    for (const sentence of String(text || "").split(/[.!?\n]+/)) {
      const list = lowerWords(sentence);
      let previous = null;
      for (const word of list) {
        const ok = word.length >= 2 && isAcceptable(word);
        if (ok) {
          if (!learned.has(word)) sortedWords = null;
          bump(learned, word);
          if (previous) {
            if (!pairs.has(previous)) pairs.set(previous, new Map());
            bump(pairs.get(previous), word);
          }
        }
        previous = ok ? word : null;
      }
    }
    prune();
  }

  function prune() {
    if (learned.size > MAX_LEARNED_WORDS) {
      const keep = [...learned.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_LEARNED_WORDS);
      learned.clear();
      keep.forEach(([w, c]) => learned.set(w, c));
      sortedWords = null;
    }
    for (const [prev, nexts] of pairs) {
      if (nexts.size > MAX_NEXT_PER_WORD) {
        const keep = [...nexts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_NEXT_PER_WORD);
        pairs.set(prev, new Map(keep));
      }
    }
    if (pairs.size > MAX_LEARNED_PAIRS) {
      const weight = (m) => [...m.values()].reduce((a, b) => a + b, 0);
      const keep = [...pairs.entries()].sort((a, b) => weight(b[1]) - weight(a[1])).slice(0, MAX_LEARNED_PAIRS);
      pairs.clear();
      keep.forEach(([p, m]) => pairs.set(p, m));
    }
  }

  function exportState() {
    return {
      v: 1,
      words: [...learned.entries()],
      pairs: [...pairs.entries()].map(([prev, nexts]) => [prev, [...nexts.entries()]]),
    };
  }

  function importState(saved) {
    if (!saved || saved.v !== 1) return;
    learned.clear();
    pairs.clear();
    for (const [word, count] of saved.words || []) {
      if (typeof word === "string" && Number.isFinite(count)) learned.set(word, Math.min(MAX_COUNT, count));
    }
    for (const [prev, nexts] of saved.pairs || []) {
      if (typeof prev !== "string" || !Array.isArray(nexts)) continue;
      pairs.set(prev, new Map(nexts.filter(([n, c]) => typeof n === "string" && Number.isFinite(c))));
    }
    sortedWords = null;
    prune();
  }

  if (state) importState(state);

  return { completeWord, predictNext, learn, exportState, importState };
}
