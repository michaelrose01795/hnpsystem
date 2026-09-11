// file location: src/features/website/data/timeline.js
//
// The "Our story since 1947" milestones at the foot of the About Us block on
// /website.
//
// Code-owned: this array is the ONE place the milestones come from. The
// public page ignores website_timeline entirely (see codeOwnedContent.js).
//
//   - add a milestone     append an object
//   - remove a milestone  delete its object — empty the array and the
//                         timeline and its heading both go, leaving the About
//                         Us copy above them
//   - reorder             move the objects; they render in written order, so
//                         keep them chronological
//
// Fields: year (also the React key, so keep it unique — "1950s" is fine),
// title, body.

export const timeline = [
  {
    year: "1947",
    title: "The blacksmith's shop",
    body: "Charles Humphries and Arthur Parks, brothers-in-law from Wadhurst, return from the war and buy an old blacksmith's shop in their village.",
  },
  {
    year: "1950s",
    title: "From lawnmowers to motors",
    body: "The business grows from selling and repairing lawnmowers and agricultural machinery into used vehicle sales and repair.",
  },
  {
    year: "1976",
    title: "Mitsubishi franchise",
    body: "Becomes Mitsubishi franchise holders — the longest established Mitsubishi dealer in the UK.",
  },
  {
    year: "1980s",
    title: "Four locations",
    body: "Expands to four Kent locations representing Mitsubishi, Daihatsu and KIA.",
  },
  {
    year: "2012",
    title: "Marcus Joy takes the helm",
    body: "Marcus Joy acquires the West Malling Mitsubishi business — the next chapter of family ownership begins.",
  },
  {
    year: "2019",
    title: "EV approved",
    body: "Achieves EVA accreditation by the Office for Low Emission Vehicles.",
  },
  {
    year: "2022",
    title: "AutoTrader award",
    body: "Wins the Customer Experience category at the AutoTrader Retailer Awards 2022.",
  },
  {
    year: "2024",
    title: "Suzuki Maidstone",
    body: "Becomes the Suzuki franchise for Maidstone, joining the existing Mitsubishi line-up.",
  },
  {
    year: "2025",
    title: "SMART repair facility",
    body: "Launches an in-house SMART repair facility — the latest of many investments in the West Malling site.",
  },
];
