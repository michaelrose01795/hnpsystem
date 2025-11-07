// file location: src/customers/data/placeholders.js
export const customerVehicles = [
  {
    id: "veh-1",
    reg: "HN70 HPA",
    makeModel: "Audi A3 Sportback",
    vin: "WAUZZZ8V5LA012345",
    mileage: "28,540",
    nextService: "2024-07-18",
  },
  {
    id: "veh-2",
    reg: "HP23 VHC",
    makeModel: "VW Tiguan R-Line",
    vin: "WVGZZZ5NZPW456789",
    mileage: "12,110",
    nextService: "2024-11-02",
  },
];

export const vhcSummaries = [
  {
    id: "vhc-1",
    vehicleId: "veh-1",
    createdAt: "2024-05-02",
    status: "Awaiting customer approval",
    amberItems: 2,
    redItems: 1,
    media: 5,
  },
  {
    id: "vhc-2",
    vehicleId: "veh-2",
    createdAt: "2024-05-21",
    status: "Approved - parts on order",
    amberItems: 0,
    redItems: 0,
    media: 3,
  },
];

export const availableParts = [
  {
    id: "part-1",
    title: "Front brake kit",
    appliesTo: ["veh-1"],
    price: "£285.00",
    availability: "In stock - 2 left",
  },
  {
    id: "part-2",
    title: "OEM cabin filter",
    appliesTo: ["veh-1", "veh-2"],
    price: "£29.50",
    availability: "Ready tomorrow 10:00",
  },
  {
    id: "part-3",
    title: "19\" diamond cut wheel (set of 4)",
    appliesTo: ["veh-2"],
    price: "£1,280.00",
    availability: "Special order - 5 days",
  },
];

export const messageContacts = [
  { id: "svc", label: "Service Manager", name: "Darrell - Workshop" },
  { id: "parts", label: "Parts Desk", name: "Scott - Parts" },
  { id: "sales", label: "Retail Sales", name: "Nicola - Sales" },
];

export const appointmentTimeline = [
  {
    id: "appt-1",
    label: "Booking confirmed",
    timestamp: "2024-05-21 08:00",
    description: "We will send reminders 48h before arrival.",
  },
  {
    id: "appt-2",
    label: "Vehicle checked in",
    timestamp: "2024-05-23 09:12",
    description: "Technician assigned and diagnostics started.",
  },
  {
    id: "appt-3",
    label: "VHC shared with you",
    timestamp: "2024-05-23 11:25",
    description: "Review videos, approve work, or request a callback.",
  },
];
