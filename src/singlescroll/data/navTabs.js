// file location: src/singlescroll/data/navTabs.js
// Top navigation tab definitions. `scrollTo` is the section anchor;
// `filter` (optional) is applied to the VehicleGallery filter state when
// the tab is clicked.
//
// Reduced to the 9-item public nav requested for the redesign:
// New, Used, Offers, Sell Your Car, Service & Parts, Motability,
// About Us, Blog, Contact Us. Parts / Team / Reviews still appear in the
// scroll story — they live under the Service & Parts and About Us
// chapters respectively, just without their own primary nav entry.

export const navTabs = [
  { id: "new", label: "New", scrollTo: "cars", filter: "new" },
  { id: "used", label: "Used", scrollTo: "cars", filter: "used" },
  { id: "offers", label: "Offers", scrollTo: "offers" },
  { id: "sell", label: "Sell Your Car", scrollTo: "sell" },
  { id: "service", label: "Service & Parts", scrollTo: "service" },
  { id: "motability", label: "Motability", scrollTo: "motability" },
  { id: "about", label: "About Us", scrollTo: "about" },
  { id: "blog", label: "Blog", scrollTo: "blog" },
  { id: "contact", label: "Contact Us", scrollTo: "contact" },
];
