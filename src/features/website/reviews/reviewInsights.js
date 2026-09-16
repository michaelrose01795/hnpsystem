// file location: src/features/website/reviews/reviewInsights.js
//
// The rules behind the Reviews block on /website (components/ReviewsPanel.js),
// kept out of the component so they read — and can be tested — on their own:
//
//   summariseRatings    one card per platform plus the overall score
//   buildStaffMatcher   finds team members named inside a quote
//   splitStaffMentions  cuts a quote into plain text and staff-name pieces
//   buildReviewFilters  the filter row, with a count per filter
//   filterReviews       the reviews one filter selects
//
// Everything reads the code-owned data modules (siteContent.ratings,
// data/reviews.js, data/team.js), so there is nothing to fetch.

export const ALL_REVIEWS_FILTER = "all";
export const STAFF_MENTIONS_FILTER = "staff";

const asList = (v) => (Array.isArray(v) ? v : []);

// "4.8 / 5" -> 4.8. A missing or unreadable score is null, never 0, so a
// platform with no published score does not drag the overall average down.
export const parseScore = (score) => {
  const n = Number.parseFloat(String(score ?? ""));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5) : null;
};

// platforms: [{ source, score (number | null), featured (reviews shown from it) }]
// overall:   mean of the scored platforms to one decimal, or null when none
export function summariseRatings(ratings, reviews) {
  const reviewList = asList(reviews);
  const platforms = asList(ratings)
    .filter((r) => r?.source)
    .map((r) => ({
      source: r.source,
      score: parseScore(r.score),
      featured: reviewList.filter((rv) => rv?.source === r.source).length,
    }));
  const scored = platforms.filter((p) => p.score != null);
  const overall = scored.length
    ? Math.round((scored.reduce((sum, p) => sum + p.score, 0) / scored.length) * 10) / 10
    : null;
  return { platforms, overall, ratedCount: scored.length };
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Matches a member's full name anywhere, and their first name on its own only
// when no one else on the team shares it — "Richard" is unambiguous, but a
// second Richard joining would stop the bare first name linking to either.
// Case-sensitive, whole words, so "mark" the verb never matches "Mark".
export function buildStaffMatcher(team) {
  const members = asList(team).filter((m) => m?.id && typeof m?.name === "string" && m.name.trim());
  const firstNameCounts = new Map();
  members.forEach((m) => {
    const first = m.name.trim().split(/\s+/)[0];
    firstNameCounts.set(first, (firstNameCounts.get(first) || 0) + 1);
  });
  const byName = new Map();
  members.forEach((m) => {
    const full = m.name.trim();
    byName.set(full, m);
    const first = full.split(/\s+/)[0];
    if (first !== full && firstNameCounts.get(first) === 1 && !byName.has(first)) {
      byName.set(first, m);
    }
  });
  if (!byName.size) return null;
  // Longest first, so "Melissa Post" wins over "Melissa".
  const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  return { pattern: `\\b(?:${names.join("|")})\\b`, byName };
}

// "Richard was great" -> [{ text: "Richard", member }, " was great"]
export function splitStaffMentions(text, matcher) {
  const quote = String(text ?? "");
  if (!matcher || !quote) return [quote];
  const parts = [];
  let last = 0;
  for (const match of quote.matchAll(new RegExp(matcher.pattern, "g"))) {
    if (match.index > last) parts.push(quote.slice(last, match.index));
    parts.push({ text: match[0], member: matcher.byName.get(match[0]) });
    last = match.index + match[0].length;
  }
  if (last < quote.length) parts.push(quote.slice(last));
  return parts;
}

export const mentionsStaff = (review, matcher) =>
  Boolean(matcher) && new RegExp(matcher.pattern).test(String(review?.quote ?? ""));

export function filterReviews(reviews, filterId, matcher) {
  const list = asList(reviews);
  if (!filterId || filterId === ALL_REVIEWS_FILTER) return list;
  if (filterId === STAFF_MENTIONS_FILTER) return list.filter((rv) => mentionsStaff(rv, matcher));
  return list.filter((rv) => asList(rv?.topics).includes(filterId));
}

// "All reviews", then every topic in the order written in data/reviews.js,
// then "Staff mentions" while there is a team to match against. A topic with
// no reviews yet keeps its pill (count 0) so the row does not reshuffle as
// reviews are added; selecting it shows an empty-state line.
export function buildReviewFilters(topics, reviews, matcher) {
  const list = asList(reviews);
  const filters = [
    { id: ALL_REVIEWS_FILTER, label: "All reviews" },
    ...asList(topics).filter((t) => t?.id && t?.label),
  ];
  if (matcher) filters.push({ id: STAFF_MENTIONS_FILTER, label: "Staff mentions" });
  return filters.map((f) => ({ ...f, count: filterReviews(list, f.id, matcher).length }));
}
