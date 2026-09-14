// file location: src/lib/typingAssist/grammarRules.js
//
// Rule-based grammar, punctuation and UK-usage checks for the typing
// assistant. Pure and synchronous — runs on every pause in typing, so every
// rule is a single regex pass. Each rule is tuned to stay quiet unless it is
// confident: a false blue underline costs more trust than a missed one.
//
// Issue shape (shared with spelling issues):
//   { kind: "grammar", rule, start, end, message, suggestions: string[], labels?: string[] }

import { nonProseRanges, overlapsRanges } from "./textTokens";
import { matchCase } from "./ukEnglish";

const ABBREVIATIONS = new Set(
  "e.g eg i.e ie etc approx vs no nos mr mrs ms dr st ltd inc dept ref tel est min max avg fig cf al jan feb mar apr jun jul aug sep sept oct nov dec mon tue tues wed thu thur thurs fri sat sun".split(" ")
);

const ALLOWED_REPEATS = new Set(["that", "had", "is", "bye", "very", "no", "yeah", "ha", "so", "really", "do", "knock", "tut", "hush", "chop"]);

// Phrase rules: the whole match is replaced. `fix` receives the regex match.
const PHRASE_RULES = [
  {
    rule: "could-of",
    re: /\b(could|should|would|must|might|may)\s+of\b/gi,
    message: "Use “have” here, not “of”.",
    fix: (m) => `${m[1]} have`,
  },
  { rule: "a-lot", re: /\balot\b/gi, message: "“A lot” is two words.", fix: () => "a lot" },
  { rule: "irregardless", re: /\birregardless\b/gi, message: "Use “regardless”.", fix: () => "regardless" },
  {
    rule: "intents-and-purposes",
    re: /\bfor all intensive purposes\b/gi,
    message: "The phrase is “for all intents and purposes”.",
    fix: () => "for all intents and purposes",
  },
  { rule: "each-other", re: /\beach others\b/gi, message: "Use “each other’s”.", fix: () => "each other's" },
  {
    rule: "their-there",
    re: /\btheir\s+(is|are|was|were|will be|has been|have been)\b/gi,
    message: "Use “there” for a place or existence.",
    fix: (m) => `there ${m[1]}`,
  },
  {
    rule: "there-their",
    re: /\bthere\s+(own|car|cars|vehicle|vehicles|account|appointment|booking|keys|details|invoice|order)\b/gi,
    message: "Use “their” to show belonging.",
    fix: (m) => `their ${m[1]}`,
  },
  { rule: "youre-welcome", re: /\byour\s+welcome\b/gi, message: "Use “you’re” (you are).", fix: () => "you're welcome" },
  {
    rule: "youre-your",
    re: /\byou['’]re\s+(car|vehicle|account|booking|appointment|order|keys|details|invoice)\b/gi,
    message: "Use “your” to show belonging.",
    fix: (m) => `your ${m[1]}`,
  },
  {
    rule: "its-it-is",
    re: /\bits\s+(a|an|been|not|going|important|possible|likely|ready|done|booked|due|fine|okay|also|now|still)\b/gi,
    message: "Use “it’s” (it is / it has).",
    fix: (m) => `it's ${m[1]}`,
  },
  { rule: "its-own", re: /\bit['’]s\s+own\b/gi, message: "Use “its” to show belonging.", fix: () => "its own" },
  {
    rule: "than-then",
    re: /\b(more|less|better|worse|rather|other|greater|fewer|higher|lower|faster|slower|bigger|smaller|older|newer|cheaper|longer|shorter|earlier|later|sooner)\s+then\b/gi,
    message: "Use “than” when comparing.",
    fix: (m) => `${m[1]} than`,
  },
  {
    rule: "whose-whos",
    re: /\bwho['’]s\s+(car|vehicle|job|booking|keys|account)\b/gi,
    message: "Use “whose” to show belonging.",
    fix: (m) => `whose ${m[1]}`,
  },
  {
    rule: "lose-loose",
    re: /\b(to|will|might|could|would|may|don['’]t|didn['’]t|not)\s+loose\b/gi,
    message: "“Lose” is the verb; “loose” means not tight.",
    fix: (m) => `${m[1]} lose`,
  },
  {
    rule: "effect-affect",
    re: /\b(the|an)\s+affect\b/gi,
    message: "“Effect” is the noun.",
    fix: (m) => `${m[1]} effect`,
  },
  {
    rule: "whether-weather",
    re: /\bweather\s+(or not|it|you|we|they|he|she)\b/gi,
    message: "Use “whether” for a choice.",
    fix: (m) => `whether ${m[1]}`,
  },
  {
    rule: "fewer-less",
    re: /\bless\s+(people|cars|vehicles|items|jobs|customers|parts|bookings|appointments)\b/gi,
    message: "Use “fewer” for things you can count.",
    fix: (m) => `fewer ${m[1]}`,
  },
  // UK English noun/verb pairs.
  {
    rule: "uk-advice",
    re: /\b(the|my|your|some|any|our|their|his|her|expert|professional|good|free|for)\s+advise\b/gi,
    message: "In UK English “advice” is the noun.",
    fix: (m) => `${m[1]} advice`,
  },
  {
    rule: "uk-advise",
    re: /\b(to|please|will|would|can|could|should|must|shall|may|might)\s+advice\b/gi,
    message: "In UK English “advise” is the verb.",
    fix: (m) => `${m[1]} advise`,
  },
  {
    rule: "uk-practise",
    re: /\b(to|will|would|can|should|must)\s+practice\b/gi,
    message: "In UK English “practise” is the verb.",
    fix: (m) => `${m[1]} practise`,
  },
  {
    rule: "uk-practice",
    re: /\b(the|a|good|in|best|common|standard|our)\s+practise\b/gi,
    message: "In UK English “practice” is the noun.",
    fix: (m) => `${m[1]} practice`,
  },
  {
    rule: "uk-licence",
    re: /\b(driving|a|the|your|my|valid|full|provisional)\s+license\b/gi,
    message: "In UK English “licence” is the noun.",
    fix: (m) => `${m[1]} licence`,
  },
  {
    rule: "uk-tyre",
    re: /\b(front|rear|spare|new|flat|worn|car|winter|summer|replacement|part-worn|four|two)\s+tire(s?)\b/gi,
    message: "In UK English a wheel’s tyre is spelt “tyre”.",
    fix: (m) => `${m[1]} tyre${m[2]}`,
  },
  {
    rule: "uk-tyre",
    re: /\btire(s?)\s+(pressure|pressures|tread|change|changes|fitting|wear|size|sizes|valve|valves)\b/gi,
    message: "In UK English a wheel’s tyre is spelt “tyre”.",
    fix: (m) => `tyre${m[1]} ${m[2]}`,
  },
  {
    rule: "brake-break",
    re: /\bbreak\s+(pad|pads|disc|discs|fluid|light|lights|caliper|calipers|pedal|hose|hoses|shoe|shoes|line|lines|system)\b/gi,
    message: "A vehicle’s brakes are spelt “brake”.",
    fix: (m) => `brake ${m[1]}`,
  },
];

function capitalise(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : word;
}

// true = "an", false = "a", null = cannot tell.
export function wantsAn(word) {
  if (!word) return null;
  if (/^[A-Z]{2,}$/.test(word)) return /^[AEFHILMNORSX]/.test(word); // spoken letter names: an MOT, a VHC
  const w = word.toLowerCase();
  if (/^(hour|honest|honour|heir)/.test(w)) return true;
  if (/^(uni|use|usu|uti|ure|uro|eu|ewe|one|once|u[bcfhjkqrst][aeiou])/.test(w)) return false;
  return /^[aeiou]/.test(w);
}

function makeIssue(start, end, rule, message, suggestions, labels) {
  const issue = { kind: "grammar", rule, start, end, message, suggestions };
  if (labels) issue.labels = labels;
  return issue;
}

export function checkGrammar(text, { multiline = true } = {}) {
  const source = String(text || "");
  if (!source.trim()) return [];
  const skip = nonProseRanges(source);
  const issues = [];
  const add = (issue) => {
    if (issue.end <= issue.start) return;
    if (overlapsRanges(issue.start, issue.end, skip)) return;
    issues.push(issue);
  };

  for (const { rule, re, message, fix } of PHRASE_RULES) {
    for (const m of source.matchAll(re)) {
      add(makeIssue(m.index, m.index + m[0].length, rule, message, [matchCase(m[0], fix(m))]));
    }
  }

  // a / an
  for (const m of source.matchAll(/\b(a|an)(\s+)([A-Za-z][A-Za-z'-]*)/gi)) {
    const before = source[m.index - 1];
    if (before && /[\w'.\-’]/.test(before)) continue;
    if (m[3].length === 1) continue;
    const needsAn = wantsAn(m[3]);
    if (needsAn === null || needsAn === (m[1].toLowerCase() === "an")) continue;
    const issue = makeIssue(
      m.index,
      m.index + m[1].length,
      "a-an",
      needsAn ? "Use “an” before a vowel sound." : "Use “a” before a consonant sound.",
      [matchCase(m[1], needsAn ? "an" : "a")]
    );
    // The verdict depends on the NEXT word, so the controller hides it while
    // that word is still being typed ("a un|" is on its way to "a unit").
    issue.contextEnd = m.index + m[0].length;
    add(issue);
  }

  // Repeated word: "the the"
  for (const m of source.matchAll(/\b([A-Za-z']+)(\s+)(\1)\b/gi)) {
    if (ALLOWED_REPEATS.has(m[1].toLowerCase())) continue;
    add(makeIssue(m.index, m.index + m[0].length, "repeated-word", "This word is repeated.", [m[1]]));
  }

  // Lower-case "i" on its own, and in I'm / I've / I'll / I'd.
  for (const m of source.matchAll(/(^|[\s("‘“])i(?=(?:['’](?:m|ve|ll|d))?(?:[\s,;:!?)"’”]|\.(?![a-z])|$))/g)) {
    const index = m.index + m[1].length;
    add(makeIssue(index, index + 1, "capital-i", "“I” is always a capital letter.", ["I"]));
  }

  // Capital letter after a full stop, question mark or exclamation mark.
  for (const m of source.matchAll(/([.!?])(["')’”]*)(\s+)([a-z][\w'’-]*)/g)) {
    const at = m.index;
    if (m[1] === ".") {
      if (source[at - 1] === "." || /\d/.test(source[at - 1] || "")) continue;
      const previous = (/([A-Za-z.]+)$/.exec(source.slice(Math.max(0, at - 12), at))?.[1] || "").toLowerCase();
      const bare = previous.replace(/\./g, "");
      if (bare.length <= 1 || ABBREVIATIONS.has(previous) || ABBREVIATIONS.has(bare)) continue;
    }
    const start = at + m[1].length + m[2].length + m[3].length;
    add(makeIssue(start, start + m[4].length, "sentence-case", "Start a sentence with a capital letter.", [capitalise(m[4])]));
  }

  // First word of a multi-line note.
  if (multiline) {
    const first = /^\s*([a-z][\w'’-]*)/.exec(source);
    if (first && source.trim().split(/\s+/).length >= 3) {
      const start = first[0].length - first[1].length;
      add(makeIssue(start, start + first[1].length, "sentence-case", "Start a sentence with a capital letter.", [capitalise(first[1])]));
    }
  }

  // Spacing and punctuation.
  for (const m of source.matchAll(/(?<=\S)( {2,})(?=\S)/g)) {
    add(makeIssue(m.index, m.index + m[1].length, "double-space", "Use a single space.", [" "], ["Use one space"]));
  }
  for (const m of source.matchAll(/(?<=[A-Za-z0-9])( +)(?=[,;:!?.](?:\s|$))/g)) {
    if (source.slice(m.index + m[1].length, m.index + m[1].length + 3) === "...") continue;
    add(makeIssue(m.index, m.index + m[1].length, "space-before-punctuation", "Remove the space before punctuation.", [""], ["Remove space"]));
  }
  for (const m of source.matchAll(/(?<=[A-Za-z])([,;])(?=[A-Za-z])/g)) {
    add(makeIssue(m.index, m.index + 1, "space-after-punctuation", "Add a space after punctuation.", [`${m[1]} `], [`${m[1]} + space`]));
  }
  for (const m of source.matchAll(/(?<=[a-z]{2})\.(?=[A-Z][a-z])/g)) {
    add(makeIssue(m.index, m.index + 1, "space-after-punctuation", "Add a space after the full stop.", [". "], ["Full stop + space"]));
  }
  for (const m of source.matchAll(/([,;:])\1+/g)) {
    add(makeIssue(m.index, m.index + m[0].length, "repeated-punctuation", "This punctuation is repeated.", [m[1]]));
  }
  for (const m of source.matchAll(/(?<!\.)\.\.(?!\.)/g)) {
    add(makeIssue(m.index, m.index + 2, "repeated-punctuation", "Use one full stop, or three for an ellipsis.", [".", "..."]));
  }

  // One issue per stretch of text: earliest wins, overlaps are dropped.
  issues.sort((a, b) => a.start - b.start || b.end - a.end);
  const result = [];
  let lastEnd = -1;
  for (const issue of issues) {
    if (issue.start < lastEnd) continue;
    result.push(issue);
    lastEnd = issue.end;
  }
  return result;
}
