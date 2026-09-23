// file location: src/features/website/helpChat/helpEngine.js
//
// Keyword assistant for the website help chat. Same approach as the staff App
// Guide (src/features/appGuide/queryEngine.js): no external LLM. The question is
// tokenised, every entry in helpKnowledge.js is scored, and the best entry's
// answer is returned, with the single best-matching paragraph from its
// longer copy quoted when that adds something.
//
// Pure and synchronous, so it runs in the API route and in unit tests alike.

import { HELP_BRAND_NAME, HELP_ENTRIES, HELP_PHONE, PAGE_GUIDES } from "./helpKnowledge";

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "am", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "can", "may", "might", "i", "me",
  "my", "we", "our", "you", "your", "it", "its", "this", "that", "these", "those", "in",
  "on", "at", "to", "for", "of", "with", "by", "from", "as", "about", "and", "or", "but",
  "if", "so", "then", "also", "just", "get", "got", "please", "thanks", "there", "here",
  "any", "some", "what", "how", "when", "which", "who", "why", "much", "many", "want",
  "need", "like", "know", "tell", "much", "ok", "okay", "hi", "hello", "hey", "us",
]);

// Terms that matter even though they are short.
const SHORT_ALLOW = new Set(["mot", "ev", "px", "hp", "uk", "0%", "pcp", "apr", "fca"]);

const MIN_SCORE = 6;

const normalise = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Words visitors use for the same thing the site copy says another way.
const SYNONYMS = { cost: "price", costs: "price", charge: "price", charges: "price", pricing: "price", priced: "price" };

// Light stemming so "services", "servicing" and "serviced" all meet "service",
// and "prices" meets "price".
const stem = (token) => {
  let t = SYNONYMS[token] || token;
  if (t.length <= 3) return t;
  if (t.length > 4 && t.endsWith("ies")) t = `${t.slice(0, -3)}y`;
  else if (/(ss|x|z|ch|sh)es$/.test(t)) t = t.slice(0, -2);
  else if (t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
  if (t.length > 5 && t.endsWith("ing")) t = t.slice(0, -3);
  else if (t.length > 4 && t.endsWith("ed")) t = t.slice(0, -2);
  if (t.length > 4 && t.endsWith("e")) t = t.slice(0, -1);
  return t;
};

export function tokenise(text) {
  return normalise(text)
    .split(" ")
    .filter((token) => token && (SHORT_ALLOW.has(token) || (token.length >= 3 && !STOPWORDS.has(token))))
    .map(stem);
}

const tokenSet = (values) => new Set(values.flatMap((value) => tokenise(value)));

const INDEXED = HELP_ENTRIES.map((entry) => ({
  entry,
  title: tokenSet([entry.title]),
  keywords: tokenSet(entry.keywords || []),
  phrases: (entry.keywords || []).map(normalise).filter((phrase) => phrase.includes(" ")),
  answer: tokenSet([entry.answer]),
  // A passage is a string, or { text, context } where context (e.g. the section
  // heading) is searchable but not quoted.
  passages: (entry.passages || []).map((passage) =>
    typeof passage === "string"
      ? { text: passage, tokens: tokenSet([passage]) }
      : { text: passage.text, tokens: tokenSet([passage.text, passage.context || ""]) },
  ),
}));

export function getPageGuide(pagePath) {
  const path = String(pagePath || "/website").split(/[?#]/)[0].replace(/\/+$/, "") || "/website";
  return PAGE_GUIDES.find((guide) => guide.matches(path)) || PAGE_GUIDES[PAGE_GUIDES.length - 1];
}

export function getGreeting(pagePath) {
  const guide = getPageGuide(pagePath);
  return {
    answer: `Hi, I'm the ${HELP_BRAND_NAME} assistant. Ask me anything about ${guide.title}, or pick a question below. If you'd rather talk to a person, press Chat with the team.`,
    links: [],
    suggestions: guide.questions.slice(0, 5),
    offerHandoff: false,
  };
}

function scoreEntry(indexed, queryTokens, normalisedQuery, guideId) {
  let score = 0;
  for (const token of queryTokens) {
    if (indexed.keywords.has(token)) score += 8;
    if (indexed.title.has(token)) score += 6;
    if (indexed.answer.has(token)) score += 2;
    if (indexed.passages.some((passage) => passage.tokens.has(token))) score += 1;
  }
  for (const phrase of indexed.phrases) {
    if (normalisedQuery.includes(phrase)) score += 6;
  }
  if (score > 0 && guideId && (indexed.entry.pages || []).includes(guideId)) score += 3;
  return score;
}

function bestPassage(indexed, queryTokens) {
  let best = null;
  let bestHits = 0;
  for (const passage of indexed.passages) {
    const hits = queryTokens.filter((token) => passage.tokens.has(token)).length;
    if (hits > bestHits) {
      best = passage.text;
      bestHits = hits;
    }
  }
  return bestHits >= 2 ? best : null;
}

const HANDOFF_RE =
  /\b(human|person|someone|somebody|agent|advisor|adviser|operator|real person|member of (the )?(staff|team)|team member|staff member|live chat|speak to (a|an|some|the)|talk to (a|an|some|the))\b/;
const GREETING_RE = /^(hi|hello|hey|hiya|good (morning|afternoon|evening)|morning|afternoon|evening)[!. ]*$/;
const THANKS_RE = /^(thanks|thank you|cheers|ta|great|perfect|brilliant|lovely|ok|okay)( (so much|very much|a lot))?[!. ]*$/;

// Questions from the page guide the visitor has not already asked.
function remainingQuestions(guide, history) {
  const asked = new Set(
    (history || []).filter((m) => m.author === "customer").map((m) => normalise(m.content)),
  );
  return guide.questions.filter((q) => !asked.has(normalise(q))).slice(0, 3);
}

/**
 * Answer a visitor's question.
 *
 * @param {string} question
 * @param {{ pagePath?: string, history?: Array<{ author: string, content: string }> }} context
 * @returns {{ answer: string, links: Array<{label: string, href: string}>, suggestions: string[], offerHandoff: boolean, entryId: string|null }}
 */
// "Do you offer X?" asks about X, not about the Offers page. Opening phrases like
// these are dropped before scoring so their verb cannot outvote the subject.
const QUERY_FILLER_RE = /^(please )?(do|does|can|could) you (offer|provide|have|do|sell)( any)? /;

export function answerQuestion(question, { pagePath = "/website", history = [] } = {}) {
  const guide = getPageGuide(pagePath);
  const rawQuery = normalise(question);
  const stripped = rawQuery.replace(QUERY_FILLER_RE, "");
  const normalisedQuery = stripped || rawQuery;
  question = normalisedQuery;
  const suggestions = remainingQuestions(guide, history);

  if (!normalisedQuery) {
    return { ...getGreeting(pagePath), entryId: null };
  }
  if (GREETING_RE.test(normalisedQuery)) {
    return { ...getGreeting(pagePath), entryId: null };
  }
  if (THANKS_RE.test(normalisedQuery)) {
    return {
      answer: "You're welcome. Is there anything else I can help with?",
      links: [],
      suggestions,
      offerHandoff: false,
      entryId: null,
    };
  }
  if (HANDOFF_RE.test(normalisedQuery)) {
    return {
      answer:
        "Of course. Press Chat with the team and I'll put you in the queue. The next available member of our team will join this chat, and you can keep it open or come back to it from History.",
      links: HELP_PHONE.href ? [{ label: `Or call ${HELP_PHONE.label}`, href: HELP_PHONE.href }] : [],
      suggestions: [],
      offerHandoff: true,
      entryId: null,
    };
  }

  let queryTokens = tokenise(question);
  let ranked = rank(queryTokens, normalisedQuery, guide.id);

  // A short follow-up ("and on saturday?") leans on the previous question.
  if ((!ranked.length || ranked[0].score < MIN_SCORE) && queryTokens.length <= 3) {
    const previous = [...(history || [])].reverse().find((m) => m.author === "customer");
    if (previous) {
      queryTokens = Array.from(new Set([...queryTokens, ...tokenise(previous.content)]));
      ranked = rank(queryTokens, `${normalisedQuery} ${normalise(previous.content)}`, guide.id);
    }
  }

  const top = ranked[0];
  if (!top || top.score < MIN_SCORE) {
    return {
      answer:
        "I'm not sure about that one. Try asking another way, pick a question below, or press Chat with the team and a member of staff will join you.",
      links: HELP_PHONE.href ? [{ label: `Call ${HELP_PHONE.label}`, href: HELP_PHONE.href }] : [],
      suggestions: guide.questions.slice(0, 3),
      offerHandoff: true,
      entryId: null,
    };
  }

  const { entry } = top.indexed;
  const passage = bestPassage(top.indexed, queryTokens);
  const answer = passage && !entry.answer.includes(passage) ? `${entry.answer}\n\n${passage}` : entry.answer;

  return {
    answer,
    links: (entry.links || []).slice(0, 3),
    suggestions,
    offerHandoff: Boolean(entry.offerHandoff),
    entryId: entry.id,
  };
}

function rank(queryTokens, normalisedQuery, guideId) {
  return INDEXED.map((indexed) => ({ indexed, score: scoreEntry(indexed, queryTokens, normalisedQuery, guideId) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}
