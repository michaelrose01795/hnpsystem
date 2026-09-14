// file location: src/features/website/legal/TermsPage.js
//
// /website/terms - the customer terms and conditions. Linked from the footer
// "Terms" / "Terms & Conditions" link on every /website page.
//
// SHAPE
// -----
// Mirrors PrivacyPolicyPage: a contents list, then one section per topic.
// Company, contact, FCA and credit-broker details are read from siteContent so
// they never drift from the footer.
//
// CONTENT OWNERSHIP
// -----------------
// This is legal copy written against UK consumer law (Consumer Rights Act 2015,
// Consumer Contracts (Information, Cancellation and Additional Charges)
// Regulations 2013, FCA consumer credit rules). Have it reviewed before launch.
//
// Styling is existing custglobal.css classes only - the same set the privacy
// page uses. No inline visual styling.

import Link from "next/link";

import StockShell from "../stock/StockShell";
import useWebsiteContent from "../hooks/useWebsiteContent";

const LAST_UPDATED = "14 September 2026";

const buildSections = ({ name, address, phone, phoneHref, fcaReg, creditDisclosure }) => [
  {
    id: "about-these-terms",
    heading: "About these terms",
    body: [
      `These terms apply when you use this website or buy a vehicle, parts or services from ${name} Limited ("we", "us"). Please read them before placing an order or booking. They do not affect your statutory rights as a consumer.`,
      "How we handle your personal information is explained separately in our privacy policy.",
    ],
    details: [
      ["Registered name", `${name} Limited`],
      ["Address", address.join(", ")],
      ["Phone", phone, phoneHref],
      fcaReg ? ["Financial Conduct Authority", fcaReg] : null,
    ].filter(Boolean),
  },
  {
    id: "using-the-website",
    heading: "Using this website",
    body: [
      "We work hard to keep vehicle details, specifications, images and prices accurate and up to date, but mistakes can happen and stock can sell quickly. Every vehicle is subject to availability, and details should be confirmed with us before you commit to buy.",
      "If we find an obvious pricing or description error, we will contact you before your order goes ahead, and you can choose to continue at the correct price or cancel for a full refund.",
      "Monthly payment examples and valuations shown on the site are guides only. A valuation is subject to inspecting the vehicle, and finance is subject to status and the lender's approval.",
    ],
  },
  {
    id: "buying-a-vehicle",
    heading: "Buying a vehicle",
    body: [
      "A contract to buy a vehicle is formed when we confirm your order in writing and receive any agreed deposit. Deposits reserve the vehicle for you and are deducted from the final price.",
      "If a vehicle is not as described, not of satisfactory quality or not fit for purpose, the Consumer Rights Act 2015 gives you the right to reject it within 30 days of delivery for a full refund, and after that the right to a repair or replacement - and in some cases a price reduction or refund.",
      "Where a sale is concluded entirely at a distance (online or by phone, without visiting us), you also have 14 days from delivery to cancel for any reason under the Consumer Contracts Regulations 2013. We may deduct an amount for use beyond what is needed to inspect the vehicle.",
    ],
  },
  {
    id: "parts-and-accessories",
    heading: "Parts and accessories ordered online",
    body: [
      "Prices in our online shop include VAT. Payment is taken securely by our payment provider at checkout, and we confirm your order by email.",
      "You may cancel an online order within 14 days of receiving the goods without giving a reason. Tell us you are cancelling, then return the items unused and in their original packaging within 14 days. We refund the price and standard delivery cost within 14 days of receiving the return. Parts made or ordered specially to your specification, and items that have been fitted, cannot be returned under this right.",
      "Faulty goods are covered by your rights under the Consumer Rights Act 2015 regardless of the cancellation period.",
    ],
  },
  {
    id: "servicing-and-repairs",
    heading: "Servicing, MOT and repairs",
    body: [
      "We carry out work with reasonable care and skill. We will give you an estimate before starting, and we will not carry out additional work costing more than the estimate without your agreement.",
      "If work we carried out is not done with reasonable care and skill, tell us and we will put it right at no cost to you. Where that is not possible, you may be entitled to a price reduction.",
      "Vehicles left with us after work is complete and you have been told they are ready for collection may incur a reasonable storage charge, which we will tell you about first.",
    ],
  },
  {
    id: "finance",
    heading: "Finance",
    body: [
      creditDisclosure,
      fcaReg,
      "Any finance agreement is made between you and the lender, on the lender's own terms. You have 14 days to withdraw from a regulated credit agreement after it is signed.",
    ].filter(Boolean),
  },
  {
    id: "liability",
    heading: "Our responsibility to you",
    body: [
      "We are responsible for loss or damage you suffer that is a foreseeable result of us breaking these terms or failing to use reasonable care and skill. We are not responsible for loss that was not foreseeable, or for business losses.",
      "Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else that cannot be limited under UK law.",
    ],
  },
  {
    id: "complaints",
    heading: "Complaints",
    body: [
      `If something is not right, please tell us first so we can put it right - call ${phone} or write to us at the address above. We aim to acknowledge complaints within five working days and resolve them within eight weeks.`,
      "If we cannot resolve a complaint about a vehicle, parts or servicing, you may refer it to The Motor Ombudsman (themotorombudsman.org). For complaints about finance that we have not resolved within eight weeks, you can refer them to the Financial Ombudsman Service (financial-ombudsman.org.uk, 0800 023 4567).",
    ],
  },
  {
    id: "law",
    heading: "Governing law and changes",
    body: [
      "These terms are governed by the law of England and Wales. If you live in Scotland or Northern Ireland, you can also bring proceedings in your local courts.",
      `We may update these terms from time to time. The version that applies to your order is the one shown when you placed it. Last updated: ${LAST_UPDATED}.`,
    ],
  },
];

export default function TermsPage() {
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
      title={`Terms and conditions - ${name}`}
      description={`The terms that apply when you use the ${name} website or buy vehicles, parts, servicing or finance from us, including your cancellation and consumer rights.`}
    >
      <section className="ws-section ws-val-hero">
        <div className="ws-container ws-val-container">
          <span className="ws-eyebrow">Legal</span>
          <h1 className="ws-h1">Terms and conditions</h1>
          <p className="ws-lead">
            The terms that apply when you use our website or buy from {name}, and the consumer rights
            you have under UK law.
          </p>
        </div>
      </section>

      <section className="ws-section ws-val-body">
        <div className="ws-container ws-val-container">
          <nav className="ws-card ws-panel" aria-label="On this page">
            <h2 className="ws-h3">On this page</h2>
            <ul className="ws-footer-links">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.heading}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ws-article-prose">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="ws-article-section">
                <h2 className="ws-article-h3">{s.heading}</h2>
                {s.body.map((text) => (
                  <p key={text} className="ws-muted">
                    {text}
                  </p>
                ))}
                {s.details?.length ? (
                  <div className="ws-article-checklist">
                    {s.details.map(([label, value, href]) => (
                      <p key={label} className="ws-muted">
                        <strong>{label}:</strong>{" "}
                        {href ? <a href={href}>{value}</a> : value}
                      </p>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>

          <p className="ws-muted">
            <Link href="/website/privacy">Read our privacy policy</Link> ·{" "}
            <Link href="/website">Back to {name}</Link>
          </p>
        </div>
      </section>
    </StockShell>
  );
}
