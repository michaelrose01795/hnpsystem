// Presentation overlay for the public, link-authenticated customer VHC view.
// Deck order is driven by docs/ui/ui-presentation.

export const vhcCustomerSlide = {
  id: "vhc-customer",
  route: "/vhc/customer/[jobNumber]/[linkCode]",
  title: "VHC: Customer View",
  roles: null,
  workflowIndex: 150,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "The customer's live VHC view",
      body: "Opened from a signed link, the customer sees their vehicle health check with photos, videos and recommended work — no account required.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Approve or decline in place",
      body: "The customer authorises or declines each item, and the workshop sees the decision update in real time.",
    },
  ],
};
