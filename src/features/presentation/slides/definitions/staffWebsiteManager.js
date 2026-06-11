// Presentation overlay for the public-website content manager.
// Deck order is driven by docs/ui/ui-presentation.

export const staffWebsiteManagerSlide = {
  id: "staff-website-manager",
  route: "/website-manager",
  title: "Website Manager",
  // Roles widened to match the actual access list (owner + admin + managers
  // + sales). Sales staff also use this to edit Offers and Vehicles.
  roles: ["owner", "admin", "admin manager", "general manager", "sales"],
  workflowIndex: 145,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "The public website, managed in-house",
      body: "Pages, sections, media and SEO for the customer-facing /website are edited here through schema-driven typed editors — no developer or agency round-trip.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Eight tabs cover every aspect",
      body: "Pages Overview · Page Content · Live Preview · Shop · Media Library · SEO & Meta · Analytics · Activity Log. The next slides walk through Live Preview and Shop in detail.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Every change is logged",
      body: "The Activity Log records who changed what and when, so the public site stays accountable and easy to roll back.",
    },
  ],
};
