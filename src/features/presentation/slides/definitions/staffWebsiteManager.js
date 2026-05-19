// Presentation overlay for the public-website content manager.
// Deck order is driven by docs/ui/ui-presentation.

export const staffWebsiteManagerSlide = {
  id: "staff-website-manager",
  route: "/staff/website-manager",
  title: "Website Manager",
  roles: ["admin", "admin manager", "owner"],
  workflowIndex: 145,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "The public website, managed in-house",
      body: "Pages, content blocks, media and SEO for the customer-facing website are edited here — no developer or agency round-trip.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Changes are tracked",
      body: "An activity log records who changed what, so the public site stays accountable and easy to roll back.",
    },
  ],
};
