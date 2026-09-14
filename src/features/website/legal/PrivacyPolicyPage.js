// file location: src/features/website/legal/PrivacyPolicyPage.js
//
// /website/privacy - the privacy, data and legal information page. Linked from
// the sign-in footnote and the footer "Privacy Policy" link.
//
// SHAPE
// -----
// Full width (LegalPageBody): an "at a glance" card, then one card per topic
// packed across the page, with the contents list, contact details and related
// pages in a side column. Company, contact, FCA and credit-broker details are
// read from siteContent so they never drift from the footer.
//
// CONTENT OWNERSHIP
// -----------------
// This is legal copy. Have it reviewed before launch, and fill in the
// registered company number and ICO registration number (LEGAL_IDS below) -
// those rows are hidden until they have a value rather than showing a guess.
//
// Styling is custglobal.css classes only (.ws-section, .ws-page-split,
// .ws-info-*). No inline visual styling.

import StockShell from "../stock/StockShell";
import LegalPageBody from "./LegalPageBody";
import useWebsiteContent from "../hooks/useWebsiteContent";

const LAST_UPDATED = "14 September 2026";

// Fill these in from Companies House and the ICO register.
const LEGAL_IDS = {
  companyNumber: "",
  icoRegistration: "",
};

const buildSections = ({ name, address, phone, phoneHref, fcaReg, creditDisclosure }) => [
  {
    id: "who-we-are",
    heading: "Who we are",
    body: [
      `${name} Limited is the data controller for the personal information we collect through this website, at our showroom and workshop, and when you contact us. This means we decide how and why your information is used and are responsible for looking after it.`,
    ],
    details: [
      ["Registered name", `${name} Limited`],
      ["Address", address.join(", ")],
      ["Phone", phone, phoneHref],
      LEGAL_IDS.companyNumber ? ["Company number", LEGAL_IDS.companyNumber] : null,
      LEGAL_IDS.icoRegistration ? ["ICO registration", LEGAL_IDS.icoRegistration] : null,
      fcaReg ? ["Financial Conduct Authority", fcaReg] : null,
    ].filter(Boolean),
  },
  {
    id: "information-we-collect",
    heading: "Information we collect",
    body: [
      "Identity and contact details: your name, email address, phone number and postal address.",
      "Vehicle details: registration, make, model, mileage, service history and valuation answers you give us.",
      "Account and transaction details: your customer account, bookings, orders, payments (card details are handled by our payment provider, not stored by us) and finance enquiries.",
      "Technical details: IP address, browser and device information, and how you use the site, collected through cookies where you have agreed to them.",
    ],
  },
  {
    id: "how-we-use",
    heading: "How we use your information and our lawful basis",
    body: [
      "To provide what you ask for - quotes, valuations, test drives, servicing, parts orders and vehicle sales. Lawful basis: performance of a contract, or steps before entering one.",
      "To meet our legal and regulatory duties, including accounting, vehicle safety recalls, anti-money-laundering checks and FCA requirements. Lawful basis: legal obligation.",
      "To run and improve our business, prevent fraud and keep the site secure. Lawful basis: legitimate interests.",
      "To send you marketing about offers, servicing reminders and events. Lawful basis: your consent, which you can withdraw at any time.",
    ],
  },
  {
    id: "sharing",
    heading: "Who we share it with",
    body: [
      "We never sell your personal information. We only share it where needed with: vehicle manufacturers and their finance companies (for warranty, recalls and finance); our panel of lenders when you ask about finance; the DVLA to look up vehicle details; payment, IT, hosting and email providers who act on our instructions; and regulators, law enforcement or professional advisers where the law requires it.",
      "Where a provider stores data outside the UK, we make sure appropriate safeguards are in place, such as UK adequacy regulations or the International Data Transfer Agreement.",
    ],
  },
  {
    id: "retention",
    heading: "How long we keep it",
    body: [
      "We keep your information only for as long as we need it. Sales, finance and accounting records are kept for six years after the end of the relevant tax year, as required by law. Vehicle service records are kept for the life of our relationship with the vehicle. Marketing preferences are kept until you withdraw consent. Enquiries that do not lead to a sale are deleted after two years.",
    ],
  },
  {
    id: "your-rights",
    heading: "Your rights",
    body: [
      "Under UK data protection law you have the right to: access the information we hold about you; have it corrected if it is wrong; have it deleted; restrict or object to how we use it; receive it in a portable format; and withdraw consent at any time where we rely on it.",
      "To use any of these rights, contact us using the details above. We will respond within one month and there is normally no charge.",
    ],
  },
  {
    id: "cookies",
    heading: "Cookies",
    body: [
      "We use essential cookies to make the site work. With your permission we also use cookies to remember your preferences and measure how the site is used. You can accept, reject or customise non-essential cookies in the cookie banner, and change your choice at any time by clearing your cookies for this site.",
    ],
  },
  {
    id: "finance",
    heading: "Finance and credit broking",
    body: [creditDisclosure, fcaReg].filter(Boolean),
  },
  {
    id: "complaints",
    heading: "Complaints",
    body: [
      `If you are unhappy with anything we have done, please tell us first so we can put it right - call ${phone} or write to us at the address above. We aim to acknowledge complaints within five working days.`,
      "For complaints about how we handle your personal data, you can contact the Information Commissioner's Office (ico.org.uk, 0303 123 1113).",
      "For complaints about finance that we have not resolved within eight weeks, you can refer them to the Financial Ombudsman Service (financial-ombudsman.org.uk, 0800 023 4567).",
    ],
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: [
      `We may update this policy from time to time. The latest version is always on this page. Last updated: ${LAST_UPDATED}.`,
    ],
  },
];

export default function PrivacyPolicyPage() {
  const { content } = useWebsiteContent();
  const { brand, contact, footer } = content.siteContent;
  const name = brand?.name || "Humphries & Parks";

  const sections = buildSections({
    name,
    address: Array.isArray(contact?.address) ? contact.address : [],
    phone: contact?.phone || "",
    phoneHref: contact?.phoneHref || "",
    fcaReg: footer?.fcaReg || "",
    creditDisclosure: footer?.creditDisclosure || "",
  });

  return (
    <StockShell
      backToSite
      title={`Privacy, data and legal information - ${name}`}
      description={`How ${name} collects, uses and protects your personal information, your data rights, cookies, finance disclosures and how to complain.`}
    >
      <section className="ws-section ws-val-hero">
        <div className="ws-container ws-val-container">
          <span className="ws-eyebrow">Legal</span>
          <h1 className="ws-h1">Privacy, data and legal information</h1>
          <p className="ws-lead">
            Everything you need to know about how {name} handles your personal information,
            your rights, and our company and regulatory details.
          </p>
        </div>
      </section>

      <LegalPageBody
        glance={{
          title: "At a glance",
          items: [
            ["Data controller", `${name} Limited`],
            ["Do we sell your data?", "Never"],
            ["Rights requests", "Answered within one month, normally free"],
            ["Data complaints", "Information Commissioner's Office"],
          ],
        }}
        sections={sections}
        contact={{
          title: "Questions about your data?",
          note: "Contact us and we will help.",
          items: [
            contact?.phone ? ["Phone", contact.phone, contact.phoneHref] : null,
            Array.isArray(contact?.address) && contact.address.length
              ? ["Address", contact.address.join(", ")]
              : null,
          ],
        }}
        links={[
          { href: "/website/terms", label: "Terms and conditions" },
          { href: "/website", label: `Back to ${name}` },
        ]}
      />
    </StockShell>
  );
}
