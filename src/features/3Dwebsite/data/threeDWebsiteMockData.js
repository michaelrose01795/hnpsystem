// file location: src/features/3Dwebsite/data/threeDWebsiteMockData.js
// ---------------------------------------------------------------------------
// MOCK DATA — standalone /3Dwebsite showcase page.
//
// This file is intentionally the single, easy-to-edit source of truth for:
//   • PALETTE  — page-local red / black / white H&P colour set (3D + UI)
//   • BUILDING — the temporary mock dealership layout (rooms, walls, sizes)
//   • STAGES   — the 7 single-scroll story stages + their floating DMS cards
//
// NOTHING here touches Supabase, live APIs, auth or the real DMS data layer.
// It is a self-contained mock. Edit any value freely — the layout below is a
// placeholder "clean box" dealership and can be swapped for the real
// Humphries & Parks building shape later without changing the components.
// ---------------------------------------------------------------------------

// --- Page-local brand palette ------------------------------------------------
// Defined here (not theme.css) on purpose: /3Dwebsite is a deliberately
// separate showcase that does not consume the DMS theme. Red / black / white.
export const PALETTE = {
  red: "#d61f2b",
  redDark: "#9d111a",
  redBright: "#ff414e",
  black: "#15161b",
  charcoal: "#23252e",
  white: "#ffffff",
  ink: "#1d1e24",
  mute: "#696d77",

  // 3D scene surfaces
  sceneBg: "#e4e5ea",
  wallOuter: "#edecef",
  wallBack: "#e1e0e5",
  divider: "#e8e7ec",
  trim: "#cf2230",

  // Vehicle / prop materials
  carGrey: "#aeb2bb", // service car — "Magnetic Grey"
  carRed: "#cf1c28", // showroom car
  carDamaged: "#74767e", // dulled panel before smart repair
  glass: "#2b303a",
  tyre: "#191a1f",
  chrome: "#d7dade",
  grime: "#6b5f4c", // valet dirt tint
};

// --- Building layout ---------------------------------------------------------
// One clean row of 7 connected rooms along the X axis. Always rendered as a
// permanent cutaway / dollhouse: back wall + side (end) walls stay visible, the
// camera-facing front wall is never built, internal dividers are half-height
// and fade automatically when the camera glides past them.
export const BUILDING = {
  roomWidth: 13, // X span of every room
  roomDepth: 11, // Z span of every room
  wallHeight: 4.4, // full perimeter wall height
  wallThick: 0.32, // wall thickness
  dividerHeight: 1.95, // half-height internal dividers (see over them)
  plinthHeight: 0.16, // raised floor lip

  // Rooms are listed entry → collection; index === stage index.
  rooms: [
    { id: "entry", name: "Reception", floor: "#e7e7ec" },
    { id: "sales", name: "Showroom", floor: "#20222a" },
    { id: "workshop", name: "Workshop", floor: "#44464f" },
    { id: "parts", name: "Parts", floor: "#d8d9de" },
    { id: "smartRepair", name: "Smart Repair", floor: "#e9e9ed" },
    { id: "valet", name: "Valet", floor: "#383b44" },
    { id: "collection", name: "Collection", floor: "#e7e7ec" },
  ],
};

// Absolute X centre of a room (or stage) given its index.
export const getRoomCenterX = (index) => index * BUILDING.roomWidth;

// --- Small pure helpers (shared by 3D + UI) ---------------------------------
export const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

// Smooth 0..1 reveal for a stage's scroll-driven effects (explode, paint,
// wash). Completes as the camera arrives at the stage and holds at 1.
export const stageReveal = (stageFloat, index, lead = 0.85) =>
  clamp01((stageFloat - (index - lead)) / lead);

// --- The 7 story stages ------------------------------------------------------
// Each stage drives one room. `cam.pos` / `cam.look` X values are OFFSETS from
// the room centre (controller adds the room centre X); Y and Z are absolute.
// `cards` feed the floating DMS cards. `feature` carries section-specific bits.
//
// status tone → pill colour:  done = black · active = red · queued = grey · alert = bright red
export const STAGES = [
  {
    id: "entry",
    index: 0,
    badge: "Stage 01 / 07",
    kicker: "Arrival",
    title: "Reception & Service Booking",
    description:
      "Every journey starts at the front desk. A customer arrives to book a service or browse the forecourt — the DMS opens a live job the moment they walk in.",
    cam: { pos: [-0.4, 6.7, 14.6], look: [0.3, 1.95, -1.0] },
    layout: "choices",
    feature: {
      prompt: "Two ways in — pick a path or let the demo follow a service booking.",
      options: [
        { id: "service", icon: "🔧", label: "Book a Service", note: "Service, MOT & repairs", target: 2 },
        { id: "buy", icon: "🚗", label: "Buy a Car", note: "Browse the showroom", target: 1 },
      ],
    },
    cards: [
      {
        id: "booking",
        icon: "📅",
        title: "Service booking created",
        subtitle: "Job opened at reception",
        rows: [
          { label: "Customer", value: "Sarah Whitmore" },
          { label: "Vehicle", value: "Ford Focus 1.0T EcoBoost" },
          { label: "Reg", value: "HP21 XKR" },
          { label: "Date", value: "Thu 28 May 2026 · 08:30" },
          { label: "Job no.", value: "JC-20416" },
        ],
        status: { label: "Booked in", tone: "active" },
      },
    ],
  },
  {
    id: "sales",
    index: 1,
    badge: "Stage 02 / 07",
    kicker: "Sales",
    title: "Showroom & Vehicle Sales",
    description:
      "On the buying path the customer moves into the showroom. Enquiry, part-exchange, finance, test drive and handover all run as one connected sales record.",
    cam: { pos: [0.9, 5.6, 12.9], look: [0.0, 1.35, -1.0] },
    layout: "grid",
    feature: { buyer: "James Holloway", stock: "Volkswagen Golf 2.0 TSI R-Line" },
    cards: [
      {
        id: "enquiry",
        icon: "🚗",
        title: "Vehicle enquiry",
        subtitle: "Golf 2.0 TSI R-Line",
        rows: [
          { label: "Stock", value: "U-7741" },
          { label: "Price", value: "£24,995" },
        ],
        status: { label: "Logged", tone: "done" },
      },
      {
        id: "partex",
        icon: "🔁",
        title: "Part exchange",
        subtitle: "Vauxhall Astra · HP18 RTV",
        rows: [
          { label: "Valuation", value: "£6,400" },
          { label: "Mileage", value: "52,110 mi" },
        ],
        status: { label: "Appraised", tone: "done" },
      },
      {
        id: "finance",
        icon: "💷",
        title: "Finance quote",
        subtitle: "Hire purchase",
        rows: [
          { label: "Term", value: "48 months" },
          { label: "Monthly", value: "£312.00" },
        ],
        status: { label: "In progress", tone: "active" },
      },
      {
        id: "testdrive",
        icon: "🛣️",
        title: "Test drive",
        subtitle: "Booked with sales",
        rows: [
          { label: "Date", value: "Sat 30 May · 11:00" },
          { label: "Exec", value: "Dani Forsythe" },
        ],
        status: { label: "Queued", tone: "queued" },
      },
      {
        id: "handover",
        icon: "🤝",
        title: "Handover",
        subtitle: "Collection prep",
        rows: [
          { label: "Plates", value: "On order" },
          { label: "Valet", value: "Booked" },
        ],
        status: { label: "Queued", tone: "queued" },
      },
    ],
  },
  {
    id: "workshop",
    index: 2,
    badge: "Stage 03 / 07",
    kicker: "Workshop",
    title: "Workshop & Diagnostics",
    description:
      "The car moves onto the ramp. A technician clocks on, works the job card and runs a full Vehicle Health Check — every finding flows straight to the next department.",
    cam: { pos: [-0.6, 5.3, 13.3], look: [0.4, 2.35, -1.2] },
    layout: "grid",
    feature: { ramp: "Ramp 3" },
    cards: [
      {
        id: "technician",
        icon: "👨‍🔧",
        title: "Technician assigned",
        subtitle: "Ramp 3",
        rows: [
          { label: "Name", value: "Liam Carver" },
          { label: "Clocked on", value: "08:42" },
        ],
        status: { label: "On the job", tone: "active" },
      },
      {
        id: "jobcard",
        icon: "📋",
        title: "Job card · JC-20416",
        subtitle: "Ford Focus · HP21 XKR",
        rows: [
          { label: "Work", value: "Full service + MOT" },
          { label: "Status", value: "On ramp — in progress" },
        ],
        status: { label: "In progress", tone: "active" },
      },
      {
        id: "checklist",
        icon: "✅",
        title: "Service checklist",
        subtitle: "32 line items",
        rows: [
          { label: "Completed", value: "24 / 32" },
          { label: "Stage", value: "Underbody" },
        ],
        status: { label: "In progress", tone: "active" },
      },
      {
        id: "vhc",
        icon: "🩺",
        title: "Vehicle Health Check",
        subtitle: "27-point inspection",
        rows: [
          { label: "Green", value: "22 items" },
          { label: "Amber / Red", value: "3 / 2 items" },
        ],
        status: { label: "Recorded", tone: "active" },
      },
      {
        id: "faults",
        icon: "⚠️",
        title: "Faults found",
        subtitle: "Sent through to parts",
        rows: [
          { label: "Front pads", value: "30% — advise" },
          { label: "O/S drop link", value: "Play — replace" },
        ],
        status: { label: "Needs parts", tone: "alert" },
      },
    ],
  },
  {
    id: "parts",
    index: 3,
    badge: "Stage 04 / 07",
    kicker: "Parts",
    title: "Parts Department",
    description:
      "The faults land in parts. The team prices, orders and books in the components — each part lifts away from the car in an exploded view as it moves through the request.",
    cam: { pos: [1.7, 6.0, 13.1], look: [-0.6, 1.75, -1.6] },
    layout: "grid",
    feature: { supplier: "Euro Car Parts", order: "PO-55820" },
    cards: [
      {
        id: "requested",
        icon: "📝",
        title: "Parts requested",
        subtitle: "From the workshop VHC",
        rows: [
          { label: "Lines", value: "2 items" },
          { label: "Raised by", value: "Liam Carver" },
        ],
        status: { label: "Complete", tone: "done" },
      },
      {
        id: "priced",
        icon: "🏷️",
        title: "Priced up",
        subtitle: "Euro Car Parts",
        rows: [
          { label: "Brake pads", value: "£48.90" },
          { label: "Drop link", value: "£22.40" },
        ],
        status: { label: "Complete", tone: "done" },
      },
      {
        id: "ordered",
        icon: "📦",
        title: "Order placed",
        subtitle: "PO-55820",
        rows: [
          { label: "Supplier", value: "ECP" },
          { label: "Cut-off", value: "11:30" },
        ],
        status: { label: "Complete", tone: "done" },
      },
      {
        id: "arrived",
        icon: "🚚",
        title: "Goods in",
        subtitle: "Booked to the job",
        rows: [
          { label: "Received", value: "13:05" },
          { label: "Bin", value: "A-14" },
        ],
        status: { label: "Just in", tone: "active" },
      },
      {
        id: "fitted",
        icon: "🔧",
        title: "Fitted to vehicle",
        subtitle: "Back with the workshop",
        rows: [
          { label: "Labour", value: "0.8 hr" },
          { label: "Sign-off", value: "Pending" },
        ],
        status: { label: "Queued", tone: "queued" },
      },
    ],
  },
  {
    id: "smartRepair",
    index: 4,
    badge: "Stage 05 / 07",
    kicker: "Smart Repair",
    title: "Smart Repair Bay",
    description:
      "A car-park scuff on the nearside rear door is booked into the smart repair bay. The spray gun sweeps the panel and the colour is restored to a factory finish.",
    cam: { pos: [-1.9, 5.1, 12.7], look: [0.6, 1.65, -1.2] },
    layout: "grid",
    feature: { damage: "Nearside rear door — car-park scuff & paint chip" },
    cards: [
      {
        id: "repairBooked",
        icon: "📅",
        title: "Repair booked",
        subtitle: "Smart repair bay",
        rows: [
          { label: "Panel", value: "N/S rear door" },
          { label: "Technician", value: "Reece Allardyce" },
        ],
        status: { label: "Complete", tone: "done" },
      },
      {
        id: "estimate",
        icon: "💷",
        title: "Estimate approved",
        subtitle: "Customer authorised",
        rows: [
          { label: "Repair", value: "£180.00" },
          { label: "Colour", value: "Magnetic Grey" },
        ],
        status: { label: "Complete", tone: "done" },
      },
      {
        id: "repairProgress",
        icon: "🎨",
        title: "Repair in progress",
        subtitle: "Prep · paint · lacquer",
        rows: [
          { label: "Stage", value: "Colour coat" },
          { label: "Booth", value: "Bay 2" },
        ],
        status: { label: "In progress", tone: "active" },
      },
      {
        id: "repairComplete",
        icon: "✨",
        title: "Repair complete",
        subtitle: "Polished & checked",
        rows: [
          { label: "Finish", value: "Curing" },
          { label: "Quality check", value: "Pending" },
        ],
        status: { label: "Queued", tone: "queued" },
      },
    ],
  },
  {
    id: "valet",
    index: 5,
    badge: "Stage 06 / 07",
    kicker: "Valet",
    title: "Valet Bay",
    description:
      "Before it goes back to the customer the car is fully valeted. A wash sweeps the dirt away, the interior is detailed and a final quality check signs it off.",
    cam: { pos: [0.4, 5.7, 13.1], look: [0.0, 1.4, -1.1] },
    layout: "grid",
    feature: { valeter: "Toni Briggs" },
    cards: [
      {
        id: "exterior",
        icon: "🚿",
        title: "Exterior wash",
        subtitle: "Snow foam & rinse",
        rows: [
          { label: "Wheels", value: "Cleaned" },
          { label: "Glass", value: "Polished" },
        ],
        status: { label: "Complete", tone: "done" },
      },
      {
        id: "interior",
        icon: "🧹",
        title: "Interior clean",
        subtitle: "Vacuum & wipe-down",
        rows: [
          { label: "Seats", value: "Cleaned" },
          { label: "Mats", value: "Refitted" },
        ],
        status: { label: "Complete", tone: "done" },
      },
      {
        id: "quality",
        icon: "🔎",
        title: "Quality check",
        subtitle: "Valeter sign-off",
        rows: [
          { label: "Walkaround", value: "Passed" },
          { label: "Valeter", value: "Toni Briggs" },
        ],
        status: { label: "Checking", tone: "active" },
      },
      {
        id: "ready",
        icon: "🌟",
        title: "Ready for collection",
        subtitle: "Moved to the collection bay",
        rows: [
          { label: "Location", value: "Collection bay 1" },
          { label: "Fuel", value: "Checked" },
        ],
        status: { label: "Queued", tone: "queued" },
      },
    ],
  },
  {
    id: "collection",
    index: 6,
    badge: "Stage 07 / 07",
    kicker: "Collection",
    title: "Collection & Drive-Away",
    description:
      "The customer is notified, the invoice is settled and the keys are ready. The car drives out — and the connected dashboard shows the whole journey, one record.",
    cam: { pos: [1.3, 6.3, 15.4], look: [2.4, 1.4, -0.6] },
    layout: "dashboard",
    feature: {
      dashboard: [
        { id: "d-booking", label: "Booking", value: "JC-20416 opened", tone: "done" },
        { id: "d-sales", label: "Sales", value: "Golf R-Line reserved", tone: "done" },
        { id: "d-workshop", label: "Workshop", value: "Service + MOT pass", tone: "done" },
        { id: "d-parts", label: "Parts", value: "PO-55820 fitted", tone: "done" },
        { id: "d-smart", label: "Smart repair", value: "N/S door restored", tone: "done" },
        { id: "d-valet", label: "Valet", value: "Cleaned & checked", tone: "done" },
        { id: "d-collection", label: "Collection", value: "Driven away · 15:10", tone: "done" },
      ],
    },
    cards: [
      {
        id: "notified",
        icon: "📲",
        title: "Customer notified",
        subtitle: "SMS + email sent",
        rows: [
          { label: "To", value: "Sarah Whitmore" },
          { label: "Sent", value: "14:50" },
        ],
        status: { label: "Complete", tone: "done" },
      },
      {
        id: "invoice",
        icon: "🧾",
        title: "Invoice settled",
        subtitle: "INV-30188",
        rows: [
          { label: "Total", value: "£487.60" },
          { label: "Paid", value: "Card · 14:58" },
        ],
        status: { label: "Complete", tone: "done" },
      },
      {
        id: "keys",
        icon: "🔑",
        title: "Keys ready",
        subtitle: "Front desk",
        rows: [
          { label: "Key tag", value: "No. 14" },
          { label: "Handover", value: "Mark Penhale" },
        ],
        status: { label: "Complete", tone: "done" },
      },
    ],
  },
];

export const STAGE_COUNT = STAGES.length;
