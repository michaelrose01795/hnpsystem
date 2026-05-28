// file location: src/features/roleTreeDemo/data/mockData.js
// Mock data only. This module powers the /vision/role-tree-demo presentation
// and must never reference live DMS data, Supabase, or API helpers.

export const presentationSections = [
  {
    id: "opening",
    label: "Opening",
    chapter: "01",
    intent: "Frame the system as an operational walkthrough.",
    takeaway: "Start with the floor, then lift the same truth upward.",
  },
  {
    id: "top-roles",
    label: "Top of the role tree",
    chapter: "02",
    intent: "Show how leadership views differ without splitting the data.",
    takeaway: "One source of truth, tailored by responsibility.",
  },
  {
    id: "departments",
    label: "Departments",
    chapter: "03",
    intent: "Make department hand-offs visible.",
    takeaway: "Every team moves the same job, not separate versions of it.",
  },
  {
    id: "problems",
    label: "Daily workflow problems",
    chapter: "04",
    intent: "Name the repeated friction the system should remove.",
    takeaway: "The cost is the constant micro-chase between people.",
  },
  {
    id: "technicians",
    label: "Technician level",
    chapter: "05",
    intent: "Ground the vision in the bay-level workflow.",
    takeaway: "The system only works if capturing the work feels simple.",
  },
  {
    id: "interactive-demo",
    label: "Interactive demo",
    chapter: "06",
    intent: "Walk the audience through the role tree in motion.",
    takeaway: "Pressure flows upward and useful context flows back down.",
  },
  {
    id: "connected-dms",
    label: "Connected DMS",
    chapter: "07",
    intent: "Bring the modules back to one centre.",
    takeaway: "The DMS becomes shared operational memory.",
  },
  {
    id: "rollout",
    label: "Phased rollout",
    chapter: "08",
    intent: "Reduce adoption risk with a controlled path.",
    takeaway: "Expand only once each workflow earns trust.",
  },
  {
    id: "final",
    label: "Final message",
    chapter: "09",
    intent: "Close on why this belongs inside H&P.",
    takeaway: "Build around the way H&P already works.",
  },
];

export const presentationStats = [
  { id: "roles", value: "5", label: "role levels" },
  { id: "departments", value: "7", label: "departments" },
  { id: "workflow", value: "1", label: "shared workflow" },
];

export const orbitDepartments = [
  { id: "service", label: "Service" },
  { id: "parts", label: "Parts" },
  { id: "workshop", label: "Workshop" },
  { id: "sales", label: "Sales" },
  { id: "admin", label: "Admin" },
  { id: "valet", label: "Valet" },
  { id: "accounts", label: "Accounts" },
];

export const openingSignals = [
  {
    id: "floor-first",
    title: "Floor-first signal",
    line: "Start with the jobs, bays, parts requests and handovers the team already lives with.",
  },
  {
    id: "role-tree",
    title: "Role-tree clarity",
    line: "Every level sees the same truth, shaped into the view they actually need.",
  },
  {
    id: "connected-flow",
    title: "Connected flow",
    line: "Departments stop acting as separate islands and start moving one job together.",
  },
];

export const topRoles = [
  {
    id: "owner",
    title: "Owner",
    summary: "Sets direction, protects the business, owns the long view.",
    signal: "Business health, exposure and direction.",
    cadence: "Daily exception view with weekly trend confidence.",
    risk: "Late visibility into pressure, margin leakage or customer risk.",
    needs: [
      "Confidence the business is running cleanly day to day",
      "A single place to see what is actually happening",
      "Numbers without chasing for them",
      "Risk visibility before it becomes a problem",
    ],
  },
  {
    id: "directors",
    title: "Directors",
    summary: "Translate strategy into department-level outcomes.",
    signal: "Cross-department performance and accountable ownership.",
    cadence: "Live operating picture with month-on-month patterns.",
    risk: "Departments optimising locally while the whole workflow slows.",
    needs: [
      "Department-level performance side by side",
      "Clear ownership of every workflow",
      "Trends across weeks, months and quarters",
      "A reliable view of staff productivity",
    ],
  },
  {
    id: "managers",
    title: "Managers",
    summary: "Run the day, unblock staff, keep customers moving.",
    signal: "Pressure, blockers, promised times and next best action.",
    cadence: "Minute-by-minute control during the working day.",
    risk: "Small delays becoming customer calls, idle bays or missed hand-offs.",
    needs: [
      "Live workshop loading and bottleneck signals",
      "Customer status without asking the floor",
      "Quick access to job, parts and VHC context",
      "Hand-offs between departments that just work",
    ],
  },
];

export const roleViewStack = [
  { id: "strategic", label: "Strategic", line: "Direction, risk, cash and operational confidence." },
  { id: "control", label: "Control", line: "Department pressure, capacity, ownership and exceptions." },
  { id: "action", label: "Action", line: "Live work, next steps, blockers and customer movement." },
];

export const dashboardCards = [
  { id: "visibility", title: "Visibility", line: "Where every job, customer and vehicle sits in real time." },
  { id: "reports", title: "Reports", line: "Numbers ready before the morning meeting." },
  { id: "productivity", title: "Productivity", line: "Time on the tools, time on hold, time chasing." },
  { id: "cost-control", title: "Cost control", line: "Parts, labour and write-offs in one place." },
  { id: "customer", title: "Customer experience", line: "Updates, ETAs and follow-ups that actually go out." },
  { id: "staff", title: "Staff efficiency", line: "Workload balance across every bay, every desk." },
];

export const departmentDeepDive = [
  { id: "intake", label: "Intake", line: "The work enters once, with customer, vehicle and priority context intact." },
  { id: "handover", label: "Handover", line: "Each department sees what changed before the next person has to ask." },
  { id: "closure", label: "Closure", line: "Invoices, updates, documents and audit trail close around the same job." },
];

export const departments = [
  {
    id: "service",
    title: "Service",
    accent: "service",
    needs: "Bookings, advisor notes, customer updates and a clean handover to workshop.",
    connects: ["parts", "workshop", "admin"],
  },
  {
    id: "parts",
    title: "Parts",
    accent: "parts",
    needs: "Live requests, stock visibility, supplier turn-around and matched-to-job ordering.",
    connects: ["service", "workshop", "accounts"],
  },
  {
    id: "workshop",
    title: "Workshop",
    accent: "workshop",
    needs: "Digital job cards, VHCs, time on the bay and progress visible to the front desk.",
    connects: ["service", "parts", "valet"],
  },
  {
    id: "sales",
    title: "Sales",
    accent: "sales",
    needs: "Stock readiness, prep status, valet booking and finance hand-offs to admin.",
    connects: ["valet", "admin", "accounts"],
  },
  {
    id: "admin",
    title: "Admin",
    accent: "admin",
    needs: "Customer records, documents, audit trail and the joins between departments.",
    connects: ["service", "sales", "accounts"],
  },
  {
    id: "valet",
    title: "Valet",
    accent: "valet",
    needs: "Booked-in vehicles, prep priorities and ready-for-handover signals.",
    connects: ["workshop", "sales"],
  },
  {
    id: "accounts",
    title: "Accounts",
    accent: "accounts",
    needs: "Authorisations, invoicing, supplier reconciliation and clean exports for finance.",
    connects: ["parts", "sales", "admin"],
  },
];

export const workflowProblems = [
  { id: "paper", title: "Paper job cards", line: "Lost, smudged, rewritten or sitting on the wrong desk." },
  { id: "duplication", title: "Duplicated information", line: "Same details typed in three different places, three different ways." },
  { id: "disconnected", title: "Disconnected systems", line: "Tools that do not talk to each other, so staff become the bridge." },
  { id: "chasing", title: "Staff chasing updates", line: "Time burned walking, calling and waiting instead of working." },
  { id: "delayed", title: "Delayed communication", line: "Customers and colleagues get the news late, if at all." },
  { id: "visibility", title: "Poor visibility", line: "No shared view between departments, so each team works blind." },
];

export const workflowImprovements = [
  { id: "one-entry", label: "One entry", line: "Capture once and reuse it through the job." },
  { id: "live-status", label: "Live status", line: "The next person sees progress without chasing." },
  { id: "clean-proof", label: "Clean proof", line: "Photos, notes, time and approvals stay attached." },
];

export const technicianTools = [
  { id: "digital-job-cards", title: "Digital job cards", line: "Every job, every step, always in your hand." },
  { id: "vhc", title: "VHC checks", line: "Structured checks, photos and severity in one flow." },
  { id: "parts", title: "Parts requests", line: "Request from the bay, parts team sees it instantly." },
  { id: "clocking", title: "Clocking", line: "Time on each job, captured without paperwork." },
  { id: "media", title: "Photos and videos", line: "Evidence captured at the bay and shared up the chain." },
  { id: "progress", title: "Job progress", line: "A tap to push the customer's status forward." },
  { id: "notes", title: "Notes", line: "Short notes that survive the day and reach the right person." },
];

export const technicianWorkflow = [
  { id: "receive", label: "Receive", line: "Job context reaches the bay with customer notes and promised times." },
  { id: "record", label: "Record", line: "Checks, media, parts and time are captured while the work happens." },
  { id: "release", label: "Release", line: "Progress flows back to service, sales, valet and accounts automatically." },
];

export const demoSteps = [
  {
    id: "demo-top",
    level: "Owner & Directors",
    callout: "What the top needs: confidence the business is running cleanly without chasing it.",
    focus: "top",
  },
  {
    id: "demo-managers",
    level: "Managers",
    callout: "Managers need live workshop loading, customer status and clean department hand-offs.",
    focus: "managers",
  },
  {
    id: "demo-departments",
    level: "Departments",
    callout: "Service, Parts, Workshop, Sales, Admin, Valet and Accounts share one workflow.",
    focus: "departments",
  },
  {
    id: "demo-workshop",
    level: "Workshop floor",
    callout: "Workshop needs digital job cards, VHCs and parts requests without leaving the bay.",
    focus: "workshop",
  },
  {
    id: "demo-technicians",
    level: "Technicians",
    callout: "Technicians push progress, photos and notes the whole business can see.",
    focus: "technicians",
  },
  {
    id: "demo-apprentice",
    level: "Apprentice technician",
    callout: "If these problems are visible from the apprentice level, they affect the whole business.",
    focus: "apprentice",
  },
];

export const demoPrinciples = [
  "Start at the business view.",
  "Follow the work through every hand-off.",
  "End where the job is actually updated.",
];

export const connectedFeatures = [
  { id: "jobs", title: "Job tracking", line: "Every job visible from booking to handover." },
  { id: "customers", title: "Customer updates", line: "Status pushed the moment it changes." },
  { id: "parts", title: "Parts requests", line: "From bay to parts desk to supplier, in one chain." },
  { id: "loading", title: "Workshop loading", line: "Capacity and pressure, live and honest." },
  { id: "progress", title: "Technician progress", line: "Time on tools, evidence and notes attached to the job." },
  { id: "dashboards", title: "Management dashboards", line: "The numbers that matter, ready when you walk in." },
  { id: "audit", title: "Audit logs", line: "Who did what, when and why, always recoverable." },
  { id: "permissions", title: "Role-based permissions", line: "The right people see the right things, automatically." },
];

export const connectedOutcomes = [
  { id: "less-chasing", title: "Less chasing", line: "People stop becoming the system between systems." },
  { id: "faster-decisions", title: "Faster decisions", line: "Managers see the blocker while it can still be fixed." },
  { id: "better-customer-flow", title: "Better customer flow", line: "Updates, evidence and timings stay close to the job." },
];

export const rolloutPhases = [
  {
    id: "phase-1",
    label: "Phase 1",
    title: "Demo and feedback",
    line: "Walk the team through it, capture honest reactions, refine the priorities.",
  },
  {
    id: "phase-2",
    label: "Phase 2",
    title: "Test selected workflows",
    line: "Run a few real workflows end to end with a small group to prove the concept.",
  },
  {
    id: "phase-3",
    label: "Phase 3",
    title: "Run alongside current systems",
    line: "Use the DMS next to existing tools, with no disruption and no forced switch.",
  },
  {
    id: "phase-4",
    label: "Phase 4",
    title: "Improve from staff feedback",
    line: "Tighten the rough edges from real usage. The people who use it shape it.",
  },
  {
    id: "phase-5",
    label: "Phase 5",
    title: "Expand only once proven",
    line: "Only widen the scope when each workflow has earned trust on the floor.",
  },
];

export const rolloutSafeguards = [
  { id: "no-forced-switch", title: "No forced switch", line: "Run alongside current systems until the workflow earns trust." },
  { id: "small-groups", title: "Small groups first", line: "Test with staff who know the pain points and will spot the gaps." },
  { id: "measured-expansion", title: "Measured expansion", line: "Only add departments once the previous step is stable." },
];

export const closingMessage = {
  headline: "Built from inside H&P, around real operational problems.",
  supporting:
    "The goal is not to force the business around software. The goal is to build software around the way H&P already works.",
};

export const closingProofPoints = [
  { id: "real-work", title: "Real work", line: "Built around live jobs, staff movement and the daily pressure points." },
  { id: "shared-truth", title: "Shared truth", line: "One operational memory instead of separate versions of the day." },
  { id: "controlled-growth", title: "Controlled growth", line: "A future platform that can grow only where it is proven useful." },
];
