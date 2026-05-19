import { WORKFLOW } from "../workflow";

const CUSTOMER_WEBSITE_ROLES = ["customer"];

export const websiteHomeSlide = {
  id: "website-home",
  route: "/website",
  title: "Public Website",
  roles: CUSTOMER_WEBSITE_ROLES,
  workflowIndex: WORKFLOW.CUSTOMER_PORTAL,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "The public customer website",
      body: "This is the same customer-facing website visitors see before signing in: vehicles, offers, servicing, Motability, reviews and contact details.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "No staff shell",
      body: "The presentation renders the public page directly so the customer experience is not mixed with internal navigation.",
    },
  ],
};

export const websiteLoginSlide = {
  id: "website-login",
  route: "/website/login",
  title: "Website Sign In",
  roles: CUSTOMER_WEBSITE_ROLES,
  workflowIndex: WORKFLOW.CUSTOMER_PORTAL + 1,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Customer account entry",
      body: "Customers enter an email first, then either sign in, claim an existing record, or create a new website account.",
    },
  ],
};

export const websiteProfileSlide = {
  id: "website-profile",
  route: "/website/profile",
  title: "Website Profile",
  roles: CUSTOMER_WEBSITE_ROLES,
  workflowIndex: WORKFLOW.CUSTOMER_PORTAL + 2,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Signed-in customer portal",
      body: "This is the real /website/profile page with the customer dashboard, vehicles, jobs, invoices, documents, messages and self-service actions.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Linked customer routes",
      body: "The VHC preview, customer view and signed share links stay in this deck so the customer can move from the website profile into the live health-check experience.",
    },
  ],
};
