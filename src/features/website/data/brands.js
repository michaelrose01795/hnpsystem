// file location: src/features/website/data/brands.js
//
// The authorised-retailer logo strip under the hero on /website.
//
// Code-owned: this array is the ONE place the strip comes from. The public
// page ignores website_brands entirely (see codeOwnedContent.js), so what is
// written here is exactly what renders.
//
//   - add a logo     append an object
//   - remove a logo  delete its object — remove them all and the strip comes
//                    off the page rather than leaving an empty label
//   - reorder        move the objects; they render left to right
//
// Fields:
//   name  the brand, doubles as the img alt text and the React key
//   logo  URL for the image — a dealer CDN link, or a file in /public
//         referenced from the site root, e.g. "/website/brands/suzuki.png".
//         Logos are sized to a common height by .ws-brands-list in
//         src/styles/custglobal.css, so supply a transparent PNG or SVG.

export const brands = [
  {
    name: "Suzuki",
    logo: "https://images.67degreescdn.co.uk/s2tcKV39K1uCnm_YVYGlIXBHQwc=/x30/smart/filters:no_upscale()/144/6/1713800908662686cc23ca7_suzuki-logo.png",
  },
  {
    name: "Mitsubishi",
    logo: "https://images.67degreescdn.co.uk/nOonSepXXKXhXUia1DWjqZRXDew=/x30/smart/filters:no_upscale()/144/6/1713800946662686f2b5c9b_mitsubishi-logo.png",
  },
];
