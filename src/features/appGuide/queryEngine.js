// file location: src/features/appGuide/queryEngine.js
//
// Internal App Guide query engine.
// No external AI or LLM is used. This engine tokenises the user's question,
// scores every entry in the knowledge index by relevance, and assembles a
// grounded answer from the matched entries. Conversation history is used
// to resolve follow-up questions.

// Webpack (used by Next.js) supports JSON imports natively without the import assertion
// eslint-disable-next-line import/no-unresolved
import knowledgeIndex from "./knowledgeIndex.json";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Words that carry no search value and are filtered before scoring
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "i", "me", "my", "we", "our",
  "you", "your", "he", "his", "she", "her", "they", "their", "it", "its",
  "this", "that", "these", "those", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "as", "into", "through", "about", "between",
  "and", "or", "but", "not", "if", "so", "then", "also", "too", "very",
  "just", "up", "out", "get", "go", "see", "use", "find", "look", "tell",
  "give", "make", "work", "know", "think", "want", "need", "say", "mean",
  "please", "thanks", "ok", "yes", "no", "there", "here", "all", "some",
  "any", "each", "which", "who", "when", "what", "how", "where", "why",
  "more", "most", "other", "than", "then", "now", "like", "only", "same",
]);

// Pronouns and demonstratives that suggest the query references a prior topic
const CONTEXT_TRIGGERS = new Set([
  "it", "this", "that", "them", "they", "those", "these", "same", "there",
  "here", "above", "mentioned", "that section", "this page", "it work",
]);

// Minimum total score an entry must reach to be included in results
const MIN_SCORE_THRESHOLD = 3;

// Maximum number of top entries to use when building an answer
const MAX_RESULTS = 4;

// ─────────────────────────────────────────────────────────────────────────────
// Text helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise text to lowercase and strip punctuation.
 * Returns a clean string suitable for tokenisation.
 */
function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split a normalised string into meaningful tokens, removing stopwords
 * and tokens shorter than 3 characters (except important 2-letter terms).
 */
function tokenise(text) {
  const SHORT_ALLOW = new Set(["hr", "id", "uk", "vhc", "mot", "vin", "dm", "qa"]);
  return normalise(text)
    .split(" ")
    .filter((token) => {
      if (!token) return false;
      if (SHORT_ALLOW.has(token)) return true;
      if (token.length < 3) return false;
      if (STOPWORDS.has(token)) return false;
      return true;
    });
}

/**
 * Build an index for a knowledge entry to avoid re-computing on every query.
 * Returns an object with pre-tokenised fields for fast scoring.
 */
function buildEntryIndex(entry) {
  return {
    titleTokens: new Set(tokenise(entry.title)),
    keywordTokens: new Set(
      (entry.keywords || []).flatMap((kw) => tokenise(kw))
    ),
    descriptionTokens: new Set(tokenise(entry.description || "")),
    detailsTokens: new Set(tokenise(entry.details || "")),
    routeTokens: new Set(
      entry.route ? entry.route.replace(/\//g, " ").split(" ").filter(Boolean) : []
    ),
    stepTokens: new Set(
      (entry.steps || []).flatMap((step) => tokenise(step))
    ),
  };
}

// Pre-build the index once on module load so searches are fast
const ENTRIES = (knowledgeIndex.entries || []).map((entry) => ({
  ...entry,
  _index: buildEntryIndex(entry),
}));

// Build a lookup map for related entry resolution
const ENTRY_MAP = Object.fromEntries(ENTRIES.map((e) => [e.id, e]));

// ─────────────────────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score a single knowledge entry against the query tokens.
 * Higher-weight fields indicate a more likely match.
 *
 * Scoring weights:
 *   Title exact token:        10
 *   Keyword exact token:       8
 *   Keyword phrase match:      6 (query token is substring of keyword or vice versa)
 *   Route segment match:       6
 *   Description token:         3
 *   Details token:             2
 *   Steps token:               2
 *   Role mention in query:     7 (if the query mentions a role this entry describes)
 */
function scoreEntry(entry, queryTokens) {
  const { _index } = entry;
  let score = 0;

  for (const token of queryTokens) {
    // Title — highest weight
    if (_index.titleTokens.has(token)) score += 10;

    // Keywords — second highest
    if (_index.keywordTokens.has(token)) {
      score += 8;
    } else {
      // Partial keyword match: the query token appears inside a keyword phrase
      for (const kw of _index.keywordTokens) {
        if (kw.includes(token) || token.includes(kw)) {
          score += 4;
          break;
        }
      }
    }

    // Route
    if (_index.routeTokens.has(token)) score += 6;

    // Description
    if (_index.descriptionTokens.has(token)) score += 3;

    // Details / steps
    if (_index.detailsTokens.has(token)) score += 2;
    if (_index.stepTokens.has(token)) score += 2;
  }

  // Bonus: if this is a role entry AND the query mentions that role directly
  if (entry.type === "role") {
    const roleTokens = tokenise(entry.title);
    const matchedRoleTokens = roleTokens.filter((rt) => queryTokens.includes(rt));
    if (matchedRoleTokens.length >= 2) score += 7;
  }

  // Bonus: how-to entries get a boost when the query contains action words
  const HOW_TO_TRIGGERS = new Set(["create", "add", "make", "use", "find", "share", "change", "move", "request", "clock", "archive", "configure"]);
  if (entry.type === "howto") {
    for (const token of queryTokens) {
      if (HOW_TO_TRIGGERS.has(token)) {
        score += 3;
        break;
      }
    }
  }

  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect the user's intent from the raw query text.
 * Returns one of: "what" | "how" | "where" | "why" | "who" | "list" | "general"
 */
function detectIntent(query) {
  const q = normalise(query);

  if (/^(what|what'?s|whats)\b/.test(q)) return "what";
  if (/^how\b/.test(q)) return "how";
  if (/^where\b/.test(q)) return "where";
  if (/^why\b/.test(q)) return "why";
  if (/^who\b/.test(q)) return "who";
  if (/^(can|does|do|is|are)\b/.test(q)) return "what";

  // Verb-first questions
  if (/\b(explain|describe|tell me about|what does|what is)\b/.test(q)) return "what";
  if (/\b(how to|how do|how can|steps to|guide to)\b/.test(q)) return "how";
  if (/\b(where (is|are|can|do|to)|find|locate|navigate to|go to)\b/.test(q)) return "where";
  if (/\b(who can|who has|which role|what role)\b/.test(q)) return "who";
  if (/\b(list|show me all|what are all|give me a list)\b/.test(q)) return "list";
  if (/\b(why (can'?t|cant|cannot|doesn'?t|don'?t))\b/.test(q)) return "why";
  if (/\b(difference between|compare|vs|versus)\b/.test(q)) return "compare";

  return "general";
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation context resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check whether a query appears to be a follow-up referring to a previous topic
 * (e.g. "How do I use it?", "Who can see this?").
 */
function isFollowUpQuery(query) {
  const q = normalise(query);
  const tokens = q.split(" ");
  // Short query that starts with or heavily uses context-trigger words
  if (tokens.length <= 6) {
    if (CONTEXT_TRIGGERS.has(tokens[0])) return true;
    if (tokens.some((t) => CONTEXT_TRIGGERS.has(t))) return true;
  }
  return false;
}

/**
 * Extract the most likely topic tokens from the most recent assistant message
 * to use as bonus context when a follow-up query is detected.
 */
function extractContextTokens(conversationHistory) {
  const messages = Array.isArray(conversationHistory) ? conversationHistory : [];
  // Walk backwards through history to find the last assistant message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && msg.role === "assistant") {
      // Pull the first ~200 chars of the response as context signal
      const sample = String(msg.content || "").slice(0, 200);
      return tokenise(sample).slice(0, 15);
    }
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Role filtering helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a role string to lowercase trimmed.
 */
function normaliseRole(role) {
  return String(role || "").toLowerCase().trim();
}

/**
 * Check whether a user (given their roles) can access an entry.
 * Entries with empty roles arrays are accessible to everyone.
 */
function userCanAccess(entry, userRoles) {
  if (!entry.roles || entry.roles.length === 0) return true;
  const normalised = (userRoles || []).map(normaliseRole);
  return entry.roles.some((r) => normalised.includes(normaliseRole(r)));
}

/**
 * Given an entry's roles array, return a human-readable access description.
 */
function describeAccess(entry) {
  if (!entry.roles || entry.roles.length === 0) {
    return "all users";
  }
  const list = entry.roles.map((r) => {
    // Title-case each role for readability
    return r
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  });
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Answer assembly
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a route string as a navigable link description.
 */
function routeLabel(route) {
  if (!route) return null;
  return route; // the UI can render this as a link
}

/**
 * Build the sources array for the answer — cited entries that informed the response.
 */
function buildSources(entries) {
  return entries
    .filter((e) => e.type !== "concept" || e.route)
    .map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      route: e.route || null,
    }));
}

/**
 * Generate up to 3 suggested follow-up questions based on the top matched entry
 * and its related entries.
 */
function buildSuggestedQuestions(topEntry, queryIntent) {
  if (!topEntry) return [];

  const suggestions = [];
  const title = topEntry.title;

  // Generate question based on what we answered
  if (queryIntent === "what" || queryIntent === "general") {
    suggestions.push(`How do I use ${title}?`);
    if (topEntry.roles && topEntry.roles.length > 0) {
      suggestions.push(`Who can access ${title}?`);
    }
  } else if (queryIntent === "how") {
    suggestions.push(`What is ${title}?`);
    suggestions.push(`Where is ${title} in the app?`);
  } else if (queryIntent === "where") {
    suggestions.push(`What does ${title} do?`);
    suggestions.push(`How do I use ${title}?`);
  } else if (queryIntent === "who") {
    suggestions.push(`What does ${title} do?`);
    suggestions.push(`How do I use ${title}?`);
  }

  // Pull in related entry titles as suggested questions
  const relatedIds = topEntry.relatedIds || [];
  for (const relId of relatedIds.slice(0, 2)) {
    const related = ENTRY_MAP[relId];
    if (related && !suggestions.some((s) => s.includes(related.title))) {
      if (related.type === "howto") {
        suggestions.push(related.title);
      } else if (related.type === "page" || related.type === "feature") {
        suggestions.push(`What is ${related.title}?`);
      }
    }
  }

  return suggestions.slice(0, 3);
}

/**
 * Compose the answer text for a "what" intent.
 */
function answerWhat(topEntry, allEntries, userRoles) {
  const parts = [];

  // Lead with the main description
  parts.push(`**${topEntry.title}**\n${topEntry.description}`);

  // Add details if available
  if (topEntry.details) {
    parts.push(topEntry.details);
  }

  // Access restriction info
  if (topEntry.roles && topEntry.roles.length > 0) {
    const accessible = userCanAccess(topEntry, userRoles);
    const accessDesc = describeAccess(topEntry);
    if (!accessible) {
      parts.push(`⚠️ This section is only accessible to: ${accessDesc}. Your current role does not include access to this area.`);
    } else {
      parts.push(`Access: Available to ${accessDesc}.`);
    }
  }

  // Route info
  if (topEntry.route) {
    parts.push(`You can find this at: ${topEntry.route}`);
  }

  // Fields list if present
  if (topEntry.fields && topEntry.fields.length > 0) {
    const fieldLines = topEntry.fields
      .slice(0, 5)
      .map((f) => `• **${f.name}** — ${f.description}`)
      .join("\n");
    parts.push(`Key fields:\n${fieldLines}`);
  }

  return parts.join("\n\n");
}

/**
 * Compose the answer text for a "how" intent.
 * Prioritises howto-type entries with step lists.
 */
function answerHow(topEntry, allEntries, userRoles) {
  // Check if the top entry is a howto with steps
  const howtoEntry = allEntries.find(
    (e) => e.type === "howto" && e.steps && e.steps.length > 0
  ) || (topEntry.steps && topEntry.steps.length > 0 ? topEntry : null);

  if (howtoEntry && howtoEntry.steps) {
    const roleNote = howtoEntry.roles && howtoEntry.roles.length > 0
      ? `\n_This action requires the ${describeAccess(howtoEntry)} role._`
      : "";
    const stepList = howtoEntry.steps
      .map((step, i) => `${i + 1}. ${step}`)
      .join("\n");
    return `**${howtoEntry.title}**\n\n${stepList}${roleNote}`;
  }

  // Fall back to a what-style answer with navigation info
  const parts = [`**${topEntry.title}**`, topEntry.description];
  if (topEntry.details) parts.push(topEntry.details);
  if (topEntry.route) parts.push(`Navigate to: ${topEntry.route}`);
  return parts.join("\n\n");
}

/**
 * Compose the answer text for a "where" intent.
 */
function answerWhere(topEntry, allEntries, userRoles) {
  const parts = [];

  if (topEntry.route) {
    parts.push(`**${topEntry.title}** is at: \`${topEntry.route}\``);
  } else {
    parts.push(`**${topEntry.title}** does not have its own dedicated page — ${topEntry.description}`);
  }

  if (topEntry.roles && topEntry.roles.length > 0) {
    const accessible = userCanAccess(topEntry, userRoles);
    const accessDesc = describeAccess(topEntry);
    if (!accessible) {
      parts.push(`⚠️ This section requires the ${accessDesc} role. You do not currently have access.`);
    } else {
      parts.push(`Accessible to: ${accessDesc}.`);
    }
  } else {
    parts.push("This is accessible to all users.");
  }

  if (topEntry.description) parts.push(topEntry.description);

  return parts.join("\n\n");
}

/**
 * Compose the answer text for a "who" intent — who can access something.
 */
function answerWho(topEntry, allEntries, userRoles) {
  const parts = [];

  if (topEntry.roles && topEntry.roles.length > 0) {
    const accessDesc = describeAccess(topEntry);
    parts.push(`**${topEntry.title}** is accessible to: **${accessDesc}**.`);
  } else {
    parts.push(`**${topEntry.title}** is accessible to all authenticated users — there is no role restriction on this section.`);
  }

  if (topEntry.description) parts.push(topEntry.description);
  if (topEntry.details) parts.push(topEntry.details);

  return parts.join("\n\n");
}

/**
 * Compose the answer text for a "why" intent — usually explaining an access restriction.
 */
function answerWhy(topEntry, allEntries, userRoles, rawQuery) {
  const parts = [];
  const q = normalise(rawQuery);

  // Check if this is a "why can't I see X" question
  const isAccessQuestion = q.includes("cant") || q.includes("can't") || q.includes("cannot") || q.includes("don't see") || q.includes("not see");

  if (isAccessQuestion && topEntry.roles && topEntry.roles.length > 0) {
    const accessDesc = describeAccess(topEntry);
    const accessible = userCanAccess(topEntry, userRoles);

    if (!accessible) {
      parts.push(`**${topEntry.title}** is restricted to: ${accessDesc}.`);
      parts.push("Your current role does not include access to this section. To gain access, ask an Admin Manager or Owner to update your role in User Admin (/admin/users).");
    } else {
      parts.push(`You should have access to **${topEntry.title}**. It is available to ${accessDesc}.`);
      parts.push("If you cannot see it, try logging out and back in, or contact an Admin Manager to verify your role is correctly set.");
    }
  } else {
    parts.push(`**${topEntry.title}**\n${topEntry.description}`);
    if (topEntry.details) parts.push(topEntry.details);

    if (topEntry.roles && topEntry.roles.length > 0) {
      parts.push(`This section is restricted to: ${describeAccess(topEntry)}.`);
    }
  }

  return parts.join("\n\n");
}

/**
 * Compose the answer text for a "compare" intent — comparing two concepts.
 */
function answerCompare(allEntries) {
  if (allEntries.length < 2) {
    const e = allEntries[0];
    if (!e) return null;
    return `**${e.title}**\n${e.description}${e.details ? "\n\n" + e.details : ""}`;
  }

  const a = allEntries[0];
  const b = allEntries[1];

  return [
    `**${a.title}**\n${a.description}${a.details ? "\n\n" + a.details : ""}`,
    "---",
    `**${b.title}**\n${b.description}${b.details ? "\n\n" + b.details : ""}`,
  ].join("\n\n");
}

/**
 * Compose the answer text for a "list" intent — listing relevant sections.
 */
function answerList(allEntries, userRoles) {
  const accessible = allEntries.filter((e) => userCanAccess(e, userRoles));
  const lines = accessible
    .slice(0, 8)
    .map((e) => {
      const routeStr = e.route ? ` — ${e.route}` : "";
      return `• **${e.title}**${routeStr}: ${e.description}`;
    });

  if (lines.length === 0) return "No matching sections found for your current role.";
  return `Here are the relevant sections I found:\n\n${lines.join("\n")}`;
}

/**
 * Fallback answer when no strong match is found.
 */
function answerFallback(rawQuery) {
  // List the top-level sections of the app as a helpful overview
  const topPages = ENTRIES
    .filter((e) => e.type === "page")
    .slice(0, 10)
    .map((e) => `• **${e.title}**${e.route ? ` (${e.route})` : ""}`)
    .join("\n");

  return [
    `I couldn't find specific information about "${rawQuery}" in the app guide.`,
    "",
    "Here are the main sections of the HNP System you can ask about:",
    topPages,
    "",
    "You can also ask me things like:",
    "• What does a Job Card do?",
    "• How do I create a job card?",
    "• Who can access the HR Manager page?",
    "• What is the difference between Status History and Workflow History?",
    "• How do slash commands work in Floating Notes?",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main search function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search the knowledge index and return a grounded answer.
 *
 * @param {string} query - The user's question text
 * @param {Array<{role: string, content: string}>} conversationHistory - Prior messages in this session
 * @param {string[]} userRoles - The current user's roles (for access-aware answers)
 * @returns {{ answer: string, sources: Array, suggestedQuestions: string[] }}
 */
export function search(query, conversationHistory = [], userRoles = []) {
  if (!query || !query.trim()) {
    return {
      answer: "Please type a question about the HNP System and I will do my best to help.",
      sources: [],
      suggestedQuestions: [
        "What does the Job Cards page do?",
        "How do I create a job card?",
        "What is Page Access?",
      ],
    };
  }

  // 1. Tokenise the query
  let queryTokens = tokenise(query);

  // 2. Expand with context tokens if this looks like a follow-up question
  if (isFollowUpQuery(query) && conversationHistory.length > 0) {
    const contextTokens = extractContextTokens(conversationHistory);
    // Merge without duplicates
    const combined = new Set([...queryTokens, ...contextTokens]);
    queryTokens = Array.from(combined);
  }

  // 3. Score every entry
  const scored = ENTRIES.map((entry) => ({
    entry,
    score: scoreEntry(entry, queryTokens),
  }))
    .filter((item) => item.score >= MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const topResults = scored.slice(0, MAX_RESULTS).map((item) => item.entry);

  // 4. If nothing scored high enough, return fallback
  if (topResults.length === 0) {
    return {
      answer: answerFallback(query),
      sources: [],
      suggestedQuestions: [
        "What pages are in the app?",
        "How do I create a job card?",
        "What does Page Access mean?",
      ],
    };
  }

  // 5. Detect intent and compose the answer
  const intent = detectIntent(query);
  const topEntry = topResults[0];
  let answer;

  switch (intent) {
    case "what":
      answer = answerWhat(topEntry, topResults, userRoles);
      break;
    case "how":
      answer = answerHow(topEntry, topResults, userRoles);
      break;
    case "where":
      answer = answerWhere(topEntry, topResults, userRoles);
      break;
    case "who":
      answer = answerWho(topEntry, topResults, userRoles);
      break;
    case "why":
      answer = answerWhy(topEntry, topResults, userRoles, query);
      break;
    case "compare":
      answer = answerCompare(topResults) || answerWhat(topEntry, topResults, userRoles);
      break;
    case "list":
      answer = answerList(topResults, userRoles);
      break;
    default:
      // "general" — pick the best answer type based on the top entry type
      if (topEntry.type === "howto") {
        answer = answerHow(topEntry, topResults, userRoles);
      } else if (topEntry.type === "role") {
        answer = answerWho(topEntry, topResults, userRoles);
      } else {
        answer = answerWhat(topEntry, topResults, userRoles);
      }
  }

  // 6. If answer composition returned null, fall back
  if (!answer) {
    answer = answerFallback(query);
  }

  return {
    answer,
    sources: buildSources(topResults.slice(0, 3)),
    suggestedQuestions: buildSuggestedQuestions(topEntry, intent),
  };
}

/**
 * Return a list of all pages in the knowledge index with their routes and access roles.
 * Useful for "list all pages" type queries.
 */
export function getAllPages() {
  return ENTRIES
    .filter((e) => e.type === "page")
    .map((e) => ({
      id: e.id,
      title: e.title,
      route: e.route,
      roles: e.roles,
      description: e.description,
    }));
}

/**
 * Return all entries of a specific type.
 */
export function getEntriesByType(type) {
  return ENTRIES.filter((e) => e.type === type).map(({ _index, ...rest }) => rest);
}

/**
 * Retrieve a single entry by its id.
 */
export function getEntryById(id) {
  const entry = ENTRY_MAP[id];
  if (!entry) return null;
  const { _index, ...rest } = entry;
  return rest;
}
