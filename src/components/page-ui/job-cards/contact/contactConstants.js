// file location: src/components/page-ui/job-cards/contact/contactConstants.js
// Shared constants + small pure helpers for the job-card Contact tab redesign.

// Full customer-preference list shown in the multiselect dropdown. Stored as a
// text[] on the customers table (Contact-tab redesign migration). The first four
// also appear as quick-toggle buttons (see QUICK_PREFERENCES).
export const PREFERENCE_OPTIONS = [
  "VIP Customer",
  "Do Not Wash",
  "Waiting Customer",
  "Courtesy Car",
  "Prefers Email",
  "Prefers Phone",
  "Reminder Call",
  "Disabled Access",
  "No Marketing",
  "Collection Only",
  "Trade Account",
  "Loyal Customer",
];

// Quick-toggle buttons rendered at the top of the Notes & Preferences section.
// `tone` maps to an .app-tone-* / .app-badge--* family so styling stays tokenised.
export const QUICK_PREFERENCES = [
  { value: "VIP Customer", label: "VIP Customer", tone: "warning" },
  { value: "Do Not Wash", label: "Do Not Wash", tone: "danger" },
  { value: "Waiting Customer", label: "Waiting Customer", tone: "info" },
  { value: "Courtesy Car", label: "Courtesy Car", tone: "success" },
];

// Channels for the contact action bar (Call / Text / Email / WhatsApp).
export const CONTACT_ACTIONS = [
  { id: "call", label: "Call", icon: "📞" },
  { id: "text", label: "Text", icon: "💬" },
  { id: "email", label: "Email", icon: "✉️" },
  { id: "whatsapp", label: "WhatsApp", icon: "🟢" },
];

// ---- pure helpers -------------------------------------------------------

const digitsOnly = (value) => String(value || "").replace(/[^\d+]/g, "");

export const toTelHref = (phone) => `tel:${digitsOnly(phone)}`;

export const toSmsHref = (phone) => `sms:${digitsOnly(phone)}`;

export const toMailtoHref = (email) => `mailto:${String(email || "").trim()}`;

// Normalise a (mostly UK) number to international digits for wa.me. Strips
// spaces/symbols, swaps a leading 0 for the UK country code, and drops a leading +.
export const toWhatsAppUrl = (phone) => {
  let n = String(phone || "").replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  else if (n.startsWith("0")) n = `44${n.slice(1)}`;
  return `https://wa.me/${n}`;
};

export const toMapsUrl = (address, postcode) => {
  const query = [address, postcode].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

// Replace {customerName} / {jobNumber} / {reg} placeholders in a template body.
export const interpolateTemplate = (body, vars = {}) =>
  String(body || "").replace(/\{(\w+)\}/g, (match, key) =>
    vars[key] != null && vars[key] !== "" ? vars[key] : match
  );
