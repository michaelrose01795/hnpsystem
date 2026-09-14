// file location: src/features/website/data/partsContent.js
//
// The Parts & Accessories copy on /website (and reused as the standing intro
// on /website/parts-catalog).
//
// Code-owned: this object is the ONE place the copy comes from. The public
// page ignores website_parts_content entirely (see codeOwnedContent.js), so
// what is written here is exactly what renders.
//
//   - reword       edit any string in place
//   - add / remove a paragraph  append to or delete from `body`
//   - add / remove a brand      append to or delete from `brands`
//   - drop the call button      delete `cta`
//
// Every field is optional on the page: an empty `body`, an empty `brands` or
// a missing `cta` simply renders without that part rather than leaving an
// empty box behind. The products themselves are NOT here — they come from the
// parts catalogue in the DMS (src/lib/database/partsCatalogPublic.js).

export const partsContent = {
  eyebrow: "Parts & Accessories",
  title: "Genuine parts. Fitted properly. First time.",
  body: [
    "We stock genuine factory parts for Suzuki and Mitsubishi — the same parts the manufacturer ships from new.",
    "Order over the counter or by phone. We do not supply parts and accessories outside mainland UK.",
  ],
  brands: [
    { name: "Suzuki", note: "Genuine Suzuki parts & accessories" },
    { name: "Mitsubishi", note: "Longest-established Mitsubishi dealer in the UK — full parts catalogue" },
  ],
  cta: { label: "Call the parts team", href: "tel:01732870711" },

  // The delivery / collection / help strip in the shop (shop/ShopServiceInfo.js).
  // Online checkout charges one flat delivery rate, shown at checkout, and has
  // no collection option — so collection is arranged with the parts team.
  serviceInfo: [
    {
      id: "delivery",
      title: "UK mainland delivery",
      body: "One flat delivery charge per order, shown at checkout. We do not ship outside mainland UK.",
    },
    {
      id: "collect",
      title: "Click & collect",
      body: "Reserve a part with the parts team and collect it from our counter at 120 London Road, West Malling.",
      link: { label: "Reserve on 01732 870711", href: "tel:01732870711" },
    },
    {
      id: "genuine",
      title: "Genuine parts",
      body: "Genuine Suzuki and Mitsubishi parts, the same ones the manufacturer fits from new.",
    },
    {
      id: "help",
      title: "Not sure it fits?",
      body: "Call with your registration and we will check the part against the manufacturer catalogue.",
      link: { label: "Call 01732 870711", href: "tel:01732870711" },
    },
  ],
};
