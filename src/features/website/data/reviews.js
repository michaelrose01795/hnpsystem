// file location: src/features/website/data/reviews.js
//
// The customer testimonials in the Reviews block on /website. Sourced from
// humphriesandparks.net/reviews.
//
// Code-owned: this array is the ONE place the quotes come from. The public
// page ignores website_reviews entirely (see codeOwnedContent.js).
//
//   - add a review     append an object
//   - remove a review  delete its object — remove them all and the filters and
//                      quote track go, leaving the rating summary and the
//                      "Leave a review" button, which are separate lists
//   - reorder          move the objects; newest first reads best
//
// The rating summary above the quotes is siteContent.ratings, and the
// "Leave a review" button is siteContent.reviewCta — both in siteContent.js.
//
// Fields:
//   id      stable unique key for React — kebab-case, never reused
//   name    the customer, as they should appear publicly
//   source  where the review was left, e.g. "Google" / "JudgeService" — match
//           a siteContent.ratings `source` so it counts towards that platform
//   date    free text, e.g. "April 2026" — not parsed, so write it as it reads
//   rating  1–5, drawn as stars (anything above 5 simply fills all five)
//   quote   the review itself, without surrounding quote marks — the page
//           adds the curly quotes around it. A team member named here (full
//           name, or a first name no one else on the team shares) becomes a
//           link to their card in Meet the Team and counts as a staff mention.
//   topics  ids from reviewTopics below — which filters the review appears
//           under. Optional; an untagged review shows under "All reviews".

// The filter pills, in the order they appear. A topic with no reviews keeps
// its pill (showing 0). "All reviews" and "Staff mentions" are added by the
// page, so they are not listed here.
export const reviewTopics = [
  { id: "car-purchase", label: "Car purchase" },
  { id: "workshop", label: "Workshop" },
  { id: "motability", label: "Motability" },
  { id: "selling", label: "Selling a car" },
  { id: "parts", label: "Parts" },
];

// How many quotes the track shows for any one filter.
export const FEATURED_REVIEW_LIMIT = 6;

export const reviews = [
  { id: "kieran-hill", name: "Kieran Hill", source: "JudgeService", date: "April 2026", rating: 5, topics: ["car-purchase"],
    quote: "Staff were attentive and listened carefully to family needs regarding a young child." },
  { id: "hannah-s", name: "Hannah S", source: "Google", date: "March 2026", rating: 5, topics: ["car-purchase"],
    quote: "Mark was amazing — made us feel at ease and was super helpful. Great service." },
  { id: "elizabeth-bw", name: "Elizabeth Brohier-Wood", source: "Google", date: "February 2026", rating: 5, topics: ["car-purchase"],
    quote: "Melissa Post was very informative and helpful all the way through purchase." },
  { id: "nicky-troughton", name: "Nicky Troughton", source: "JudgeService", date: "January 2026", rating: 5, topics: ["car-purchase"],
    quote: "Richard made the long-distance purchase process easier, patiently answering questions." },
  { id: "amelia-cardwell", name: "Amelia Cardwell", source: "Google", date: "February 2026", rating: 5, topics: ["car-purchase"],
    quote: "Such a lovely team who made the whole process easy. Richard was amazing." },
  { id: "gordon-king", name: "Gordon King", source: "Google", date: "January 2026", rating: 5, topics: ["car-purchase"],
    quote: "Experience was outstanding, stress-free and supported by Richard. Highly recommend." },
  { id: "paul-cheesman", name: "Paul Cheesman", source: "Google", date: "November 2025", rating: 5, topics: ["car-purchase"],
    quote: "Bradley made buying a car so easy. Excellent customer service." },
  { id: "antony-shopland", name: "Antony Shopland", source: "JudgeService", date: "October 2025", rating: 5, topics: ["car-purchase"],
    quote: "Richard was friendly and informative. Felt like buying with a friend." },
  { id: "sue-sears", name: "Sue Sears", source: "Trustpilot", date: "May 2025", rating: 5, topics: ["selling"],
    quote: "Friendly, professional and fair with valuations. Funds transferred quickly." },
  { id: "matt-briggs", name: "Matt Briggs", source: "Trustpilot", date: "July 2024", rating: 5, topics: ["car-purchase"],
    quote: "Low pressure experience. Car clean and validated. Great collection process." },
];
