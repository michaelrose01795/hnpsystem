// file location: src/pages/tracking/index.js
//
// /tracking was one page with four tabs. Each tab is now its own page, reached
// from its own sidebar module:
//   Key/Parking      /tracking/Key-Parking      (General)
//   Loan Cars        /tracking/Loan-car         (Service)
//   Equipment/Tools  /tracking/Equipment-Tools  (Workshop)
//   Oil/Stock        /tracking/Oil-Stock        (Parts)
//
// This route only forwards old addresses — bookmarks, links from job cards and
// QR labels already printed as /tracking?tab=oil-stock&stock=… — to the page
// that replaced the tab. Every other query parameter is passed through, so
// ?jobNumber=…&openPopup=true, ?asset=… and ?stock=… keep working. The target
// page applies its own access rules.

const TAB_DESTINATIONS = {
  tracker: "/tracking/Key-Parking",
  "loan-cars": "/tracking/Loan-car",
  equipment: "/tracking/Equipment-Tools",
  "oil-stock": "/tracking/Oil-Stock",
};

export async function getServerSideProps({ query }) {
  const { tab, ...rest } = query || {};
  const destination = TAB_DESTINATIONS[typeof tab === "string" ? tab : ""] || TAB_DESTINATIONS.tracker;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(rest)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) search.append(key, item);
    }
  }
  const suffix = search.toString();
  return {
    redirect: { destination: suffix ? `${destination}?${suffix}` : destination, permanent: false },
  };
}

export default function TrackingRedirect() {
  return null;
}
