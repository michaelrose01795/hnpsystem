// file location: src/features/website/helpChat/helpKnowledge.js
//
// What the website help chat knows. Every answer is built from the same
// code-owned content modules the /website pages render (./data), so a change to
// the opening hours, the phone number, an offer or a Help & Advice article
// changes the chat's answer in the same edit. Nothing here calls an external AI.
//
// Entry shape:
//   id        stable key
//   title     what the entry is about (weighted highly when scoring)
//   keywords  words / short phrases a visitor would type
//   answer    the reply, plain text; "\n" breaks and "• " bullets render as-is
//   passages  optional longer copy; the engine quotes the one paragraph that
//             best matches the question (e.g. the price line of the servicing
//             article when someone asks "how much is a service")
//   links     [{ label, href }] rendered as buttons under the reply
//   pages     page guide ids where the entry is the likely answer (small boost)
//
// PAGE_GUIDES maps the route the visitor is on to the five questions offered
// when the chat opens there.

import { siteContent } from "@/features/website/data/siteContent";
import { blogPosts } from "@/features/website/data/blogPosts";
import { offers } from "@/features/website/data/offers";
import { partsContent } from "@/features/website/data/partsContent";
import { team, teamDepartments } from "@/features/website/data/team";

const list = (value) => (Array.isArray(value) ? value : []);
const hoursLines = (rows) => list(rows).map((row) => `• ${row.days}: ${row.time}`).join("\n");
const bullets = (items) => list(items).map((item) => `• ${item}`).join("\n");

const {
  brand = {},
  trustPoints,
  ratings,
  reviewCta,
  about = {},
  serviceAndParts = {},
  motability = {},
  sellYourCar = {},
  contact = {},
  footer = {},
} = siteContent;

const brandName = brand.name || "Humphries & Parks";
const phone = contact.phone || "";
const phoneHref = contact.phoneHref || (phone ? `tel:${phone.replace(/\s+/g, "")}` : "");
const callLink = phone ? [{ label: `Call ${phone}`, href: phoneHref }] : [];
const mapsHref = list(contact.address).length
  ? `https://www.google.com/maps?q=${encodeURIComponent(list(contact.address).join(", "))}`
  : "";

const LINKS = {
  contact: { label: "Contact details", href: "/website#contact" },
  stock: { label: "Browse stock", href: "/website/available-stock" },
  offers: { label: "See offers", href: "/website#offers" },
  valuation: { label: "Free valuation", href: "/website/valuation" },
  appointment: { label: "Request an appointment", href: "/website/request-appointment" },
  parts: { label: "Parts catalogue", href: "/website/parts-catalog" },
  shop: { label: "Shop", href: "/website/shop" },
  basket: { label: "Open basket", href: "/website/shop/cart" },
  login: { label: "Sign in", href: "/website/login" },
  profile: { label: "My account", href: "/website/profile" },
  privacy: { label: "Privacy policy", href: "/website/privacy" },
  terms: { label: "Terms & conditions", href: "/website/terms" },
  help: { label: "Help & advice", href: "/website#blog" },
  reviews: { label: "Reviews", href: "/website#reviews" },
  about: { label: "About us", href: "/website#about" },
  motability: { label: "Motability", href: "/website#motability" },
};

const trustLine = list(trustPoints)
  .map((point) => `• ${point.value} ${point.label}`)
  .join("\n");

const CORE_ENTRIES = [
  {
    id: "contact-phone",
    title: "Phone number",
    keywords: ["phone", "call", "ring", "telephone", "number", "contact", "phone number", "contact you"],
    answer: phone
      ? `You can call ${brandName} on ${phone}. Sales and service both answer on that number during opening hours.`
      : `Our contact details are at the bottom of the home page.`,
    links: [...callLink, LINKS.contact],
    pages: ["home"],
  },
  {
    id: "location",
    title: "Where we are",
    keywords: ["address", "where", "located", "location", "directions", "find you", "visit", "map", "postcode", "showroom", "parking"],
    answer: list(contact.address).length
      ? `We're at:\n${list(contact.address).join(", ")}.\n\nCome and see us during opening hours, no appointment needed for the showroom.`
      : "Our address is in the Contact section of the home page.",
    links: [mapsHref ? { label: "Open in Google Maps", href: mapsHref } : null, LINKS.contact].filter(Boolean),
    pages: ["home"],
  },
  {
    id: "opening-hours",
    title: "Opening hours",
    keywords: ["opening", "hours", "open", "close", "closing", "times", "today", "weekend", "saturday", "sunday", "when are you open"],
    answer: [
      list(contact.salesHours).length ? `Sales:\n${hoursLines(contact.salesHours)}` : "",
      list(contact.serviceHours).length ? `Service:\n${hoursLines(contact.serviceHours)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    links: [LINKS.contact, ...callLink],
    pages: ["home", "appointment"],
  },
  {
    id: "service-booking",
    title: "Book a service or MOT",
    keywords: ["service", "servicing", "book", "booking", "appointment", "workshop", "mot", "repair", "diagnostics", "tyres", "bodyshop", "warranty work"],
    answer: [
      "You can request a workshop appointment online. Tell us what needs doing and when suits you, and our service team will confirm a time.",
      list(serviceAndParts.body).join("\n"),
      list(serviceAndParts.hours).length ? `Service hours:\n${hoursLines(serviceAndParts.hours)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    links: [LINKS.appointment, ...callLink],
    pages: ["home", "appointment", "profile"],
  },
  {
    id: "motability",
    title: "Motability",
    keywords: ["motability", "disability", "mobility", "allowance", "adaptations", "adapted", "lease", "pip", "dla"],
    answer: [
      list(motability.body).join("\n"),
      motability.payments || "",
      list(motability.rangeBrands).length
        ? `Available across:\n${list(motability.rangeBrands)
            .map((range) => `• ${range.brand}: ${list(range.models).join(", ")}`)
            .join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    links: [
      motability.cta?.href ? { label: motability.cta.label || "Speak to a specialist", href: motability.cta.href } : null,
      LINKS.motability,
    ].filter(Boolean),
    pages: ["home"],
  },
  {
    id: "sell-your-car",
    title: "Sell your car",
    keywords: ["sell", "selling", "part exchange", "px", "trade in", "valuation", "value", "worth", "quote", "buy my car", "outstanding finance", "fee", "fees", "paid", "payment"],
    answer: [
      list(sellYourCar.steps).length
        ? `Selling to us takes three steps:\n${list(sellYourCar.steps)
            .map((step) => `${step.n}. ${step.title}: ${step.body}`)
            .join("\n")}`
        : "",
      list(sellYourCar.benefits).length ? bullets(sellYourCar.benefits) : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    links: [LINKS.valuation],
    pages: ["home", "valuation", "stock"],
  },
  {
    id: "valuation-how",
    title: "How the free valuation works",
    keywords: ["valuation", "how does", "registration", "mileage", "what do i need", "online valuation", "no obligation"],
    answer:
      "Start the free valuation with your registration and mileage. That's all we need to begin, and we come back with a fair, no-obligation quote. If you accept, we collect the car free of charge and pay you by bank transfer.",
    links: [LINKS.valuation],
    pages: ["valuation"],
  },
  {
    id: "finance",
    title: "Finance",
    keywords: ["finance", "credit", "apr", "pcp", "hp", "hire purchase", "monthly", "payments", "lender", "loan", "deposit", "broker"],
    answer: [
      "We can arrange finance on new and used cars, and some manufacturer offers include 0% APR or 0% PCP on selected models.",
      footer.creditDisclosure || "",
      footer.fcaReg || "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    links: [LINKS.offers, ...callLink],
    pages: ["stock", "stock-detail", "legal"],
  },
  {
    id: "offers",
    title: "Current offers",
    keywords: ["offers", "offer", "deals", "deal", "discount", "saving", "savings", "promotion", "new car offers", "0%"],
    answer: list(offers).length
      ? `Current manufacturer offers:\n${list(offers)
          .map((offer) => `• ${offer.title}: ${offer.headline}`)
          .join("\n")}\n\nOffers apply to selected models and stock.`
      : "There are no manufacturer offers listed right now. Call us and we'll tell you what's available.",
    passages: list(offers).map((offer) => `${offer.title}: ${offer.headline}. ${offer.body}`),
    links: [LINKS.offers],
    pages: ["home", "stock"],
  },
  {
    id: "stock",
    title: "Cars in stock",
    keywords: ["cars", "car", "stock", "used", "new", "vehicles", "vehicle", "buy", "browse", "search", "available", "second hand"],
    answer:
      "Every car we have in stock is listed on the Available stock page. Filter by new or used and open any car for photos, the full spec and price.",
    links: [LINKS.stock],
    pages: ["home", "stock"],
  },
  {
    id: "warranty-checks",
    title: "Warranty and vehicle checks",
    keywords: ["warranty", "inspection", "checks", "checked", "guarantee", "quality", "mot", "used car checks", "120"],
    answer: trustLine
      ? `Every car we sell comes with:\n${trustLine}`
      : "Every used car is inspected before sale and comes with warranty and MOT.",
    links: [LINKS.stock],
    pages: ["stock", "stock-detail"],
  },
  {
    id: "test-drive",
    title: "Test drives and viewings",
    keywords: ["test drive", "drive", "viewing", "view", "see the car", "try", "reserve", "hold", "deposit", "available still"],
    answer: [
      "To arrange a test drive or viewing, or to check a car is still available, call our sales team or pop in during sales hours.",
      list(contact.salesHours).length ? `Sales hours:\n${hoursLines(contact.salesHours)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    links: [...callLink, LINKS.stock],
    pages: ["stock", "stock-detail"],
  },
  {
    id: "parts",
    title: "Parts and accessories",
    keywords: ["parts", "part", "accessories", "genuine", "spares", "catalogue", "catalog", "order a part", "fit", "fitted", "fitting"],
    answer: [list(partsContent.body).join("\n"), list(partsContent.brands).map((b) => `• ${b.name}: ${b.note}`).join("\n")]
      .filter(Boolean)
      .join("\n\n"),
    passages: [
      ...list(partsContent.body),
      "Our workshop can fit the parts for you. Request a workshop appointment and tell us what you've ordered.",
    ],
    links: [LINKS.parts, partsContent.cta?.href ? { label: partsContent.cta.label, href: partsContent.cta.href } : null].filter(Boolean),
    pages: ["parts", "shop"],
  },
  {
    id: "delivery",
    title: "Delivery",
    keywords: ["deliver", "delivery", "shipping", "postage", "post", "abroad", "international", "outside uk", "overseas", "europe"],
    answer:
      "We do not supply parts and accessories outside mainland UK. For anything else about delivery of an order, ask our parts team.",
    links: [...callLink, LINKS.parts],
    pages: ["parts", "shop"],
  },
  {
    id: "shop-basket",
    title: "The basket and checkout",
    keywords: ["basket", "cart", "checkout", "order", "buy online", "pay", "payment", "card", "shop", "account to order", "guest"],
    answer:
      "Add items to your basket from the shop or the parts catalogue, then open the basket and go to checkout: your details first, then payment. You don't need an account. If you're signed in, your basket is saved to your account; if not, it's kept on this device.",
    links: [LINKS.basket, LINKS.shop],
    pages: ["shop", "parts"],
  },
  {
    id: "account",
    title: "Your account",
    keywords: ["account", "sign in", "log in", "login", "register", "create account", "sign up", "signup", "profile", "portal", "my account"],
    answer:
      "Sign in or create an account with your email address. Your account shows your vehicles, MOT and service history, invoices, payments and documents. You can also book work and message our team from it.",
    links: [LINKS.login, LINKS.profile],
    pages: ["login", "profile"],
  },
  {
    id: "password",
    title: "Passwords and sign-in problems",
    keywords: ["password", "forgot", "reset", "change password", "locked", "cant sign in", "can't log in", "email address", "change email"],
    answer:
      "Once you're signed in you can change your password or email address from your account. If you can't get in, chat with a member of our team or call us and we'll help you back in.",
    links: [LINKS.login, ...callLink],
    pages: ["login", "profile"],
  },
  {
    id: "profile-vehicles",
    title: "Vehicles in your account",
    keywords: ["add vehicle", "add a car", "my vehicles", "garage", "update mileage", "mileage", "registration", "my car"],
    answer:
      "In your account, open your vehicles to add a car by its registration or update its mileage. MOT, recalls and service history for each car sit alongside it.",
    links: [LINKS.profile],
    pages: ["profile"],
  },
  {
    id: "invoices-documents",
    title: "Invoices and documents",
    keywords: ["invoice", "invoices", "receipt", "documents", "statement", "pdf", "payments", "money", "bill", "paperwork"],
    answer:
      "Your invoices, payments and documents are in your account, under Money, Payments and Documents. If something is missing, request it from the same page and we'll send it over.",
    links: [LINKS.profile],
    pages: ["profile"],
  },
  {
    id: "message-team",
    title: "Messaging our team",
    keywords: ["message", "messages", "email", "enquiry", "question for", "get in touch", "reply", "contact the team"],
    answer:
      "You can message our team from the Messages section of your account, or press Chat with the team in this window to wait for someone to join you here.",
    links: [LINKS.profile, ...callLink],
    pages: ["profile", "home"],
  },
  {
    id: "about",
    title: `About ${brandName}`,
    keywords: ["about", "history", "family", "founded", "1947", "who are you", "awards", "award", "ev approved", "electric", "dealer", "authorised"],
    answer: [
      list(about.body).join("\n\n"),
      list(about.highlights).map((h) => `• ${h.title}: ${h.body}`).join("\n"),
    ]
      .filter(Boolean)
      .join("\n\n"),
    links: [LINKS.about],
    pages: ["home"],
  },
  {
    id: "brands",
    title: "Brands we sell and service",
    keywords: ["brands", "brand", "suzuki", "mitsubishi", "kgm", "makes", "franchise", "manufacturer", "other makes"],
    answer: [
      "We're authorised retailers and service agents for Suzuki and Mitsubishi.",
      list(partsContent.brands).map((b) => `• ${b.name}: ${b.note}`).join("\n"),
      "We buy any age, make or model when you sell your car to us.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    links: [LINKS.stock, LINKS.parts],
    pages: ["home", "parts"],
  },
  {
    id: "reviews",
    title: "Reviews and ratings",
    keywords: ["reviews", "review", "rating", "ratings", "google", "autotrader", "judgeservice", "feedback", "stars"],
    answer: list(ratings).length
      ? `How customers rate us:\n${list(ratings)
          .map((rating) => `• ${rating.source}: ${rating.score}`)
          .join("\n")}${reviewCta?.note ? `\n\n${reviewCta.note}` : ""}`
      : "Our customer reviews are on the home page.",
    links: [LINKS.reviews, reviewCta?.href ? { label: reviewCta.label || "Leave a review", href: reviewCta.href } : null].filter(Boolean),
    pages: ["home"],
  },
  {
    id: "team",
    title: "Our team",
    keywords: ["team", "staff", "people", "specialists", "departments", "who works", "manager", "sales team", "service team"],
    answer: list(teamDepartments).length
      ? `Our team is organised into:\n${list(teamDepartments)
          .map((dep) => {
            const count = list(team).filter((member) => member.department === dep.id).length;
            return `• ${dep.label}${count ? ` (${count})` : ""}`;
          })
          .join("\n")}`
      : "Meet the team on our home page.",
    links: [{ label: "Meet the team", href: "/website#team" }],
    pages: ["home"],
  },
  {
    id: "privacy",
    title: "Privacy and your data",
    keywords: ["privacy", "data", "gdpr", "personal information", "rights", "delete my data", "information", "share", "keep"],
    answer:
      "Our privacy policy explains who we are, what information we collect, how and why we use it, who we share it with, how long we keep it and your rights over it.",
    links: [LINKS.privacy],
    pages: ["legal", "login"],
  },
  {
    id: "cookies",
    title: "Cookies",
    keywords: ["cookies", "cookie", "consent", "tracking", "analytics", "manage cookies"],
    answer:
      "When you first visit, the cookie notice lets you choose which cookies to allow. The Cookies section of our privacy policy explains each type.",
    links: [LINKS.privacy],
    pages: ["legal"],
  },
  {
    id: "terms",
    title: "Terms and conditions",
    keywords: ["terms", "conditions", "legal", "t&cs", "tcs", "small print"],
    answer: "Our terms and conditions cover using this website, orders and bookings.",
    links: [LINKS.terms],
    pages: ["legal"],
  },
  {
    id: "complaints",
    title: "Complaints",
    keywords: ["complaint", "complain", "unhappy", "problem", "issue", "ombudsman", "not happy", "escalate"],
    answer:
      "We're sorry something hasn't gone right. The quickest way to sort it is to talk to us: press Chat with the team below or call us. The Complaints section of our privacy policy explains the formal process.",
    links: [...callLink, LINKS.privacy],
    pages: ["legal"],
    offerHandoff: true,
  },
  {
    id: "fca",
    title: "FCA registration",
    keywords: ["fca", "regulated", "authorised", "registration number", "financial conduct"],
    answer: [footer.fcaReg, footer.creditDisclosure].filter(Boolean).join("\n\n"),
    links: [LINKS.privacy],
    pages: ["legal"],
  },
  {
    id: "socials",
    title: "Social media",
    keywords: ["facebook", "instagram", "youtube", "social", "socials", "social media"],
    answer: list(contact.socials).length
      ? `Follow us on ${list(contact.socials).map((s) => s.label).join(", ")}.`
      : "Find us on social media from the Contact section.",
    links: list(contact.socials).map((s) => ({ label: s.label, href: s.href })),
    pages: ["home"],
  },
];

// One entry per Help & Advice article. The article's own headings and body
// are searchable, so "how much is an MOT" finds the price paragraph.
const ARTICLE_ENTRIES = list(blogPosts).map((post) => {
  const detail = post.detail || {};
  const sections = list(detail.sections);
  return {
    id: `article-${post.id}`,
    title: post.title,
    keywords: [post.category, ...sections.map((section) => section.heading)].filter(Boolean),
    answer: [
      post.excerpt,
      sections.length ? `The guide covers:\n${sections.map((section) => `• ${section.heading}`).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    passages: [
      detail.lead,
      ...sections.flatMap((section) => list(section.body).map((text) => ({ text, context: section.heading }))),
      ...list(detail.checklist?.items),
    ].filter(Boolean),
    links: [
      LINKS.help,
      detail.cta?.href && detail.cta.href.startsWith("/") ? { label: detail.cta.label, href: detail.cta.href } : null,
    ].filter(Boolean),
    pages: [],
  };
});

export const HELP_ENTRIES = [...CORE_ENTRIES, ...ARTICLE_ENTRIES];

export const HELP_BRAND_NAME = brandName;
export const HELP_PHONE = { label: phone, href: phoneHref };

// Five opening questions per page. First match wins, so specific routes sit
// above the catch-all home guide.
export const PAGE_GUIDES = [
  {
    id: "stock-detail",
    matches: (path) => path.startsWith("/website/stock/"),
    title: "this car",
    questions: [
      "Can I book a test drive?",
      "Do you offer finance?",
      "What warranty comes with the car?",
      "Can I part exchange my current car?",
      "What are your sales opening hours?",
    ],
  },
  {
    id: "stock",
    matches: (path) => path === "/website/available-stock",
    title: "our stock",
    questions: [
      "Do you have any new car offers?",
      "What checks are done on your used cars?",
      "Do you offer finance?",
      "Can I sell my car to you?",
      "How do I arrange a test drive?",
    ],
  },
  {
    id: "shop",
    matches: (path) => path.startsWith("/website/shop"),
    title: "the shop",
    questions: [
      "How does the basket and checkout work?",
      "Do I need an account to order?",
      "Do you deliver outside the UK?",
      "Are your parts genuine?",
      "What's your phone number?",
    ],
  },
  {
    id: "parts",
    matches: (path) => path.startsWith("/website/parts-catalog"),
    title: "the parts catalogue",
    questions: [
      "Are your parts genuine?",
      "Which brands do you stock parts for?",
      "Do you deliver outside the UK?",
      "Can you fit the parts for me?",
      "How do I order a part?",
    ],
  },
  {
    id: "valuation",
    matches: (path) => path.startsWith("/website/valuation"),
    title: "selling your car",
    questions: [
      "How does the free valuation work?",
      "What do I need to value my car?",
      "How do I get paid when I sell?",
      "Do you buy cars with outstanding finance?",
      "Are there any fees to sell my car?",
    ],
  },
  {
    id: "appointment",
    matches: (path) => path.startsWith("/website/request-appointment"),
    title: "workshop appointments",
    questions: [
      "What happens at a service?",
      "How much does an MOT cost?",
      "What are your service opening hours?",
      "What do my MOT advisories mean?",
      "Where are you located?",
    ],
  },
  {
    id: "login",
    matches: (path) => path.startsWith("/website/login"),
    title: "signing in",
    questions: [
      "How do I create an account?",
      "I can't sign in to my account",
      "What can I do in my account?",
      "How do you use my data?",
      "Can I book a service without an account?",
    ],
  },
  {
    id: "profile",
    matches: (path) => path.startsWith("/website/profile"),
    title: "your account",
    questions: [
      "How do I add a vehicle?",
      "Where are my invoices?",
      "How do I book a service?",
      "How do I message the team?",
      "How do I change my password?",
    ],
  },
  {
    id: "legal",
    matches: (path) => path.startsWith("/website/privacy") || path.startsWith("/website/terms"),
    title: "our policies",
    questions: [
      "How do you use my data?",
      "How do I manage cookies?",
      "What are your terms and conditions?",
      "How do I make a complaint?",
      "Are you regulated by the FCA?",
    ],
  },
  {
    id: "home",
    matches: () => true,
    title: `${brandName}`,
    questions: [
      "What are your opening hours?",
      "Where are you located?",
      "How do I book a service?",
      "Do you offer Motability cars?",
      "How do I sell my car to you?",
    ],
  },
];
