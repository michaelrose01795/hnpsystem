// file location: src/lib/messages/messageTokens.js
//
// Splits a message body into renderable tokens. Pure — no React — so the
// renderer (src/components/page-ui/messages/MessageContent.js), in-conversation
// search and the unit tests all read a message the same way.
//
//   • record references  /job 12345, /12345, /reg AB12 CDE, /part BP1, /appt,
//                        /invoice, /vhc, /cust[Jane] and the legacy quick links
//                        (/parts, /tracking …)
//   • @mentions          @[Name](u:123)
//   • web addresses      http(s)://…
//
// Job links follow the reader's role, exactly as before the redesign:
// technicians land on /tech/<job>, everyone else on the job card.

import { getLinkType } from "@/lib/messages/conversationModel";

const QUICK_LINKS = {
  parts: { href: "/stock-catalogue", label: "Parts" },
  tracking: { href: "/tracking/Key-Parking", label: "Vehicle tracking" },
  valet: { href: "/valet", label: "Valet" },
  hr: { href: "/hr/manager", label: "HR" },
  clocking: { href: "/clocking", label: "Clocking" },
  archive: { href: "/archive", label: "Job archive" },
  myjobs: { href: "/tech", label: "My jobs" },
  appointments: { href: "/appointments", label: "Appointments" },
};

// One pattern, alternatives in priority order. Group indexes are read in
// tokenize() below.
const TOKEN_PATTERN = new RegExp(
  [
    "@\\[([^\\[\\]]+)\\]\\(u:(\\d+)\\)", // 1 name, 2 id
    "(https?:\\/\\/[^\\s<]+[^\\s<.,;:!?)\\]])", // 3 url
    "\\/cust(?:\\[([^\\]]+)\\]|\\s+([^\\n/@]+?)(?=$|\\n|\\s\\/|\\s@))", // 4 bracketed, 5 plain customer
    "\\/(parts|tracking|valet|hr|clocking|archive|myjobs|appointments)\\b", // 6 quick link
    // A registration may be written with its space ("AB12 CDE").
    "\\/reg\\s+([A-Za-z0-9]{2,4}(?:\\s?[A-Za-z0-9]{3})?)(?![A-Za-z0-9])", // 7 reg
    "\\/(job|part|appt|invoice|vhc|order|account)\\s*([A-Za-z0-9][A-Za-z0-9._-]{0,39})", // 8 kind, 9 value
    "\\/(\\d{2,10})\\b", // 10 bare job number
  ].join("|"),
  "gi"
);

const jobHref = (jobNumber, roles = []) =>
  roles.map((role) => String(role).toLowerCase()).includes("technician")
    ? `/tech/${encodeURIComponent(jobNumber)}`
    : `/job-cards/${encodeURIComponent(jobNumber)}`;

const refFor = (kind, rawValue, roles) => {
  const value = String(rawValue || "").trim();
  switch (kind) {
    case "job":
      return { href: jobHref(value, roles), label: `Job ${value}` };
    case "vhc":
      return { href: `/job-cards/${encodeURIComponent(value)}?tab=vhc`, label: `VHC ${value}` };
    case "reg":
      return { href: getLinkType("vehicle").buildHref(value.toUpperCase()), label: value.toUpperCase() };
    case "part":
      return { href: getLinkType("part").buildHref(value), label: `Part ${value}` };
    case "appt":
      return { href: getLinkType("appointment").buildHref(value), label: `Appointment · Job ${value}` };
    case "invoice":
      return { href: getLinkType("invoice").buildHref(value), label: `Invoice ${value}` };
    case "order":
      return { href: `/order/${encodeURIComponent(value)}`, label: `Order ${value}` };
    case "account":
      return { href: `/accounts/view/${encodeURIComponent(value)}`, label: `Account ${value}` };
    default:
      return null;
  }
};

export function tokenizeMessage(content = "", roles = []) {
  const text = String(content || "");
  const out = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    if (match.index > last) out.push({ type: "text", value: text.slice(last, match.index) });
    last = match.index + match[0].length;
    if (match[1]) {
      out.push({ type: "mention", value: match[1], userId: Number(match[2]) });
    } else if (match[3]) {
      out.push({ type: "url", value: match[3] });
    } else if (match[4] || match[5]) {
      // A customer is linked to the conversation when the message is sent;
      // inline it reads as a highlighted name.
      out.push({ type: "ref", label: (match[4] || match[5]).trim(), href: null });
    } else if (match[6]) {
      const quick = QUICK_LINKS[match[6].toLowerCase()];
      out.push({ type: "ref", label: quick.label, href: quick.href });
    } else if (match[7]) {
      out.push({ type: "ref", ...refFor("reg", match[7], roles) });
    } else if (match[8]) {
      const ref = refFor(match[8].toLowerCase(), match[9], roles);
      out.push(ref ? { type: "ref", ...ref } : { type: "text", value: match[0] });
    } else if (match[10]) {
      out.push({ type: "ref", label: `Job ${match[10]}`, href: jobHref(match[10], roles) });
    } else {
      out.push({ type: "text", value: match[0] });
    }
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

// For search highlighting and previews: the words a reader actually sees.
export function readableText(content = "", roles = []) {
  return tokenizeMessage(content, roles)
    .map((token) => (token.type === "mention" ? `@${token.value}` : token.value ?? token.label ?? ""))
    .join("");
}

