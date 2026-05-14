// file location: src/pages/vision/_data/visionMockData.js
// Mock-only Vision data. This module is isolated from live DMS data, APIs, auth,
// Supabase, job cards, and production workflows.

export const visionNav = [
  { slug: "system-map", title: "System Map", group: "Overview" },
  { slug: "workflow-coordination", title: "Workflow Coordination", group: "Core Layers" },
  { slug: "operational-intelligence", title: "Operational Intelligence", group: "Core Layers" },
  { slug: "communication-layer", title: "Communication Layer", group: "Core Layers" },
  { slug: "workshop-intelligence", title: "Workshop Intelligence", group: "Departments" },
  { slug: "service-advisor-intelligence", title: "Service Advisor", group: "Departments" },
  { slug: "sales-intelligence", title: "Sales Intelligence", group: "Departments" },
  { slug: "parts-intelligence", title: "Parts Intelligence", group: "Departments" },
  { slug: "vhc-intelligence", title: "VHC Intelligence", group: "Departments" },
  { slug: "vehicle-prep", title: "Vehicle Prep", group: "Departments" },
  { slug: "valet", title: "Valet", group: "Departments" },
  { slug: "smart-repair", title: "SMART Repair", group: "Departments" },
  { slug: "mot", title: "MOT", group: "Departments" },
  { slug: "finance", title: "Finance", group: "Departments" },
  { slug: "site-operations", title: "Site Operations", group: "Operations" },
  { slug: "mobile-technician", title: "Mobile Technician", group: "Operations" },
  { slug: "management", title: "Management", group: "Leadership" },
  { slug: "future-platform", title: "Future Platform", group: "Leadership" },
  { slug: "roadmap", title: "Roadmap", group: "Leadership" },
];

export const visionLayers = [
  {
    title: "Core DMS Layer",
    description: "The existing source of truth for jobs, customers, vehicles, bookings, stock, messages, and operational records.",
    items: ["Jobs", "Customers", "Vehicles", "Bookings", "Messages", "Parts", "Invoices"],
  },
  {
    title: "Workflow Engine Layer",
    description: "Routes work between departments when mock exit conditions are met.",
    items: ["Event monitor", "Dependency checks", "Task generation", "Escalations", "Recovery queues"],
  },
  {
    title: "Intelligence Layer",
    description: "Creates reviewable analysis, scores, summaries, trends, and recommendations from mock operational signals.",
    items: ["Analysis", "Recommendations", "Summaries", "Trend detection", "Operational memory"],
  },
  {
    title: "Coordination Layer",
    description: "Keeps workshop, sales, parts, valet, prep, advisors, finance, and managers aligned.",
    items: ["Smart queues", "Handover readiness", "Cross-department awareness", "Workflow health"],
  },
  {
    title: "Management Layer",
    description: "Shows pressure, capacity, revenue opportunities, bottlenecks, and daily summaries.",
    items: ["Heatmap", "Capacity model", "Staffing suggestions", "Daily summary", "Revenue opportunities"],
  },
  {
    title: "Future Platform Layer",
    description: "A long-term operating system with persistent memory, connected events, and dealership-wide orchestration.",
    items: ["Operational ecosystem", "Digital nervous system", "Self-learning workflows", "Live pressure model"],
  },
];

export const visionDepartments = [
  { slug: "workshop-intelligence", title: "Workshop", metric: "18 active jobs", pressure: "High", summary: "Delay risk concentrated around parts and ramp availability." },
  { slug: "service-advisor-intelligence", title: "Service Advisor", metric: "9 follow-ups", pressure: "Medium", summary: "Customer update drafts prepared for jobs at collection risk." },
  { slug: "sales-intelligence", title: "Sales", metric: "6 hot enquiries", pressure: "Medium", summary: "Silent customers and missed follow-ups are ranked for review." },
  { slug: "parts-intelligence", title: "Parts", metric: "7 supply risks", pressure: "High", summary: "Supplier reliability and affected jobs are visible before delays land." },
  { slug: "vhc-intelligence", title: "VHC", metric: "14 items pending", pressure: "Medium", summary: "Priority ranking combines safety, value, media, and approval likelihood." },
  { slug: "vehicle-prep", title: "Vehicle Prep", metric: "11 stock vehicles", pressure: "High", summary: "Prep route, photos, SMART repair, valet, and go-live checks are linked." },
  { slug: "valet", title: "Valet", metric: "8 queued", pressure: "High", summary: "Collection slots drive the priority queue and readiness checks." },
  { slug: "management", title: "Management", metric: "4 bottlenecks", pressure: "High", summary: "A single view of capacity, load balancing, revenue risk, and forecast pressure." },
];

export const featureGroups = {
  "workflow-coordination": {
    title: "Workflow Coordination",
    intro: "A mock operating layer that routes events, checks dependencies, creates tasks, escalates stalled work, and keeps departments aware.",
    features: [
      "Automatic Workflow Routing",
      "Operational Dependency Tracking",
      "Auto Task Generation",
      "Workflow Escalation System",
      "Smart Queue Systems",
      "Workflow Recovery Systems",
      "Operational Event Engine",
      "Cross-Department Awareness",
      "Intelligent Handover Coordination",
      "Workflow Health Monitoring",
    ],
  },
  "operational-intelligence": {
    title: "Operational Intelligence",
    intro: "Shared analysis, summary, recommendation, trend, notification, and memory services shown as a mock architecture.",
    features: [
      "Centralised Analysis Engine",
      "Reusable Recommendation Engine",
      "Reusable Summary Generator",
      "Historical Trend Analysis",
      "Role-Aware Summary System",
      "Intelligent Notification Filtering",
      "Event Subscription Architecture",
      "Engine-Agnostic UI Layer",
      "Operational Memory Engine",
      "Workflow Optimisation Engine",
    ],
  },
  "communication-layer": {
    title: "Communication Layer",
    intro: "Reviewable customer and internal message drafts connected to mock jobs, vehicles, customers, and workflow events.",
    features: [
      "Suggested Customer Responses",
      "Auto Customer Update Drafts",
      "Suggested Internal Replies",
      "Smart Mention Suggestions",
      "Message Importance Detection",
      "Workflow Trigger Messages",
      "Workflow-Aware Conversations",
      "Customer Communication Timeline",
      "Intelligent Internal Messaging Coordination",
    ],
  },
  "workshop-intelligence": {
    title: "Workshop Intelligence",
    intro: "Mock workshop jobs, technicians, ramps, summaries, delay risk, parts requests, repeat faults, equipment reminders, and training signals.",
    features: [
      "Smart Job Summary",
      "Delayed Job Detection",
      "Smart Technician Allocation",
      "Smart Parts Requests",
      "Clocking Pattern Analysis",
      "Job Flow Prediction",
      "Efficiency Drift Detection",
      "Repeat Fault Detection",
      "Comeback Risk Analysis",
      "Toolbox & Equipment Reminders",
      "Technician Context Summary",
      "Skill Growth Tracking",
      "Suggested Training Areas",
    ],
  },
  "service-advisor-intelligence": {
    title: "Service Advisor Intelligence",
    intro: "Mock bookings, calls, queue pressure, walk-ins, check-in summaries, collection risk, and customer update suggestions.",
    features: [
      "Timeline Compression",
      "Call Follow-Up Tracking",
      "Smart Booking Suggestions",
      "Queue Time Monitoring",
      "Walk-In Pressure Detection",
      "Collection Risk Detection",
      "Check-In Summary Generator",
      "Suggested Customer Updates",
    ],
  },
  "sales-intelligence": {
    title: "Sales Intelligence",
    intro: "Native enquiry and forecourt insights using manager-safe wording: Analysis, Insights, Review, Suggested Actions, and Follow-Up.",
    features: [
      "Sales Enquiry Assistant",
      "Smart Enquiry Analysis",
      "Missed Opportunity Detection",
      "Auto Sales Notes",
      "Vehicle Interest Trends",
      "Trade-In Risk Detection",
      "Margin Risk Prediction",
      "Fast-Sale Probability",
      "Vehicle Sourcing Suggestions",
      "Test Drive Follow-Up Detection",
      "Predictive Customer Behaviour",
      "Silent Customer Detection",
      "Loyalty Pattern Tracking",
    ],
  },
  "parts-intelligence": {
    title: "Parts Intelligence",
    intro: "Mock stock, supplier reliability, duplicate request detection, job impact, collection queue, and alternative part suggestions.",
    features: [
      "Auto Parts Availability Prediction",
      "Smart Parts Ordering",
      "Duplicate Parts Request Detection",
      "Fast-Moving Stock Detection",
      "Dead Stock Detection",
      "Parts Delay Impact Detection",
      "Technician Collection Queue",
      "Suggested Alternative Parts",
    ],
  },
  "vhc-intelligence": {
    title: "VHC Intelligence",
    intro: "Mock red, amber, and green items ranked by priority, approval probability, missing media, and customer-ready wording.",
    features: [
      "VHC Priority Detection",
      "Approval Probability Scoring",
      "Customer-Friendly Explanation Generator",
      "Missing Media Detection",
      "VHC Conversion Optimisation",
      "VHC Priority Ranking",
    ],
  },
  "vehicle-prep": {
    title: "Vehicle Prep",
    intro: "Mock stock vehicle routing from appraisal through workshop, SMART repair, photography, valet, and go-live.",
    features: [
      "Prep Delay Predictor",
      "Smart Prep Routing",
      "Photo Checklist Detection",
      "Appraisal Summary Generator",
      "Vehicle Buying Intelligence",
      "High-Risk Purchase Detection",
      "Margin Risk Prediction",
      "Fast-Sale Probability",
      "Vehicle Sourcing Suggestions",
    ],
  },
  valet: {
    title: "Valet",
    intro: "Mock valet priority queue, collection readiness, handover checks, slot pressure, and backlog visibility.",
    features: ["Valet Priority Queue", "Collection Readiness Detection", "Handover Readiness Checks", "Collection Slot Pressure", "Valet Backlog"],
  },
  "smart-repair": {
    title: "SMART Repair",
    intro: "Mock damage trends, repair estimates, complexity routing, paint usage, and repeat damage locations.",
    features: ["Damage Pattern Logging", "Smart Time Estimates", "Repair Complexity Detection", "Paint Material Usage Tracking", "Repeat Damage Location Tracking"],
  },
  mot: {
    title: "MOT",
    intro: "Mock MOT failure trends, retest queue, bay use, and common advisory patterns.",
    features: ["MOT Failure Trend Tracking", "MOT Retest Priority Queue", "MOT Bay Utilisation Tracking", "Common Advisory Detection"],
  },
  finance: {
    title: "Finance",
    intro: "Mock invoice risk, late payment, warranty claim summary, and finance application follow-up tracking.",
    features: ["Invoice Risk Detection", "Late Payment Detection", "Warranty Claim Summary Generator", "Finance Application Follow-Up Tracking"],
  },
  "site-operations": {
    title: "Site Operations",
    intro: "Mock key movement, parking pressure, vehicle movement, site delay, key cabinet, and dwell analysis.",
    features: ["Key Movement Monitoring", "Parking Pressure Mapping", "Vehicle Movement Analysis", "Site Delay Detection", "Key Cabinet Analytics", "On-Site Vehicle Dwell Analysis"],
  },
  "mobile-technician": {
    title: "Mobile Technician",
    intro: "Mock mobile routing, van stock, job risk, specialist tool, and return-to-workshop detection.",
    features: ["Route Efficiency Suggestions", "Mobile Stock Suggestions", "Mobile Job Risk Detection", "Return-To-Workshop Detection"],
  },
  management: {
    title: "Management",
    intro: "Mock dealership-wide pressure, staffing, summaries, revenue, forecast, dashboards, load balancing, bottlenecks, and capacity modelling.",
    features: [
      "Department Pressure Heatmap",
      "Staffing Suggestions",
      "Auto Daily Summary",
      "Revenue Opportunity Detection",
      "Dealer Performance Intelligence",
      "Forecasted Busy Days",
      "Adaptive Dashboard System",
      "Department Load Balancing",
      "Predictive Operational Bottlenecking",
      "Real-Time Dealership Capacity Modelling",
    ],
  },
  "future-platform": {
    title: "Future Platform",
    intro: "A future architecture board for the dealership as one connected operational ecosystem.",
    features: [
      "Unified dealership operational ecosystem",
      "Live cross-department coordination",
      "Predictive dealership intelligence",
      "Self-learning dealership workflows",
      "Dealership-wide operational scoring",
      "Real-time workflow orchestration",
      "Connected operational dependency mapping",
      "Live operational pressure modelling",
      "Dealership digital nervous system",
      "Persistent operational memory layer",
    ],
  },
};

export const mockKpis = [
  { label: "Mock workflows monitored", value: "126", trend: "+18 today" },
  { label: "Reviewable suggestions", value: "34", trend: "12 high value" },
  { label: "Blocked dependencies", value: "7", trend: "3 urgent" },
  { label: "Manager summary items", value: "11", trend: "Ready for 17:00" },
];

export const mockWorkflowEvents = [
  {
    id: "evt-101",
    title: "Parts arrived for delayed service job",
    vehicle: "Swift SZ-T - AB12 HNP",
    department: "Parts -> Workshop",
    status: "Ready to route",
    created: ["Notify technician", "Move job from waiting parts", "Update service advisor"],
    messages: ["Parts have arrived for AB12 HNP. Workshop can resume and customer update is ready for review."],
    checks: ["Part booked in", "Technician available", "Ramp 2 free in 20m"],
  },
  {
    id: "evt-102",
    title: "Collection slot approaching but valet not complete",
    vehicle: "Vitara SZ5 - HN66 OPS",
    department: "Workshop -> Valet -> Advisor",
    status: "Escalation pending",
    created: ["Raise valet priority", "Draft customer delay update", "Notify service lead"],
    messages: ["Collection is booked for 16:30. Valet backlog risks a late handover."],
    checks: ["Workshop complete", "Invoice drafted", "Valet incomplete", "Second key present"],
  },
  {
    id: "evt-103",
    title: "Retail prep blocked by missing photos",
    vehicle: "S-Cross Ultra - ST24 PRE",
    department: "Prep -> Photography -> Sales",
    status: "Recovery suggested",
    created: ["Create photo checklist task", "Move vehicle to media bay", "Update stock readiness"],
    messages: ["Retail prep is otherwise complete. Missing side profile and interior media before go-live."],
    checks: ["PDI complete", "SMART repair complete", "Valet complete", "Media incomplete"],
  },
];

export const mockRecords = [
  { title: "Job 48291", meta: "Workshop", status: "Delay risk high", detail: "Front brakes authorised, parts available, technician clocked 1h12m, customer promised 16:30." },
  { title: "Enquiry 2194", meta: "Sales", status: "Follow-Up due", detail: "Customer interested in Swift automatic under GBP 15k. Test drive requested for Saturday." },
  { title: "Part 55821", meta: "Parts", status: "Supplier risk", detail: "ETA moved twice. Alternative supplier has one unit at higher cost with same-day delivery." },
  { title: "VHC 7742", meta: "VHC", status: "Missing media", detail: "Red tyre item has no supporting photo. Approval probability improves when media is added." },
  { title: "Stock 331", meta: "Prep", status: "Go-live blocked", detail: "Vehicle cleaned and mechanically ready. Needs rear quarter image and appraisal summary review." },
];

export const mockAlerts = [
  "Valet queue pressure rising before 16:00 collections.",
  "Three open customer updates have exceeded the target response window.",
  "Parts supplier reliability dipped on same-day brake stock.",
  "Two repeat braking complaints match prior model pattern.",
];

export const mockSuggestedActions = [
  "Move AB12 HNP to Ramp 2 when the current job clocks off.",
  "Review and send the prepared collection update for HN66 OPS.",
  "Assign the photo checklist to media bay before the stock meeting.",
  "Ask parts to approve the alternative supplier on the delayed service job.",
];

export const mockSummaries = [
  "Workshop pressure is high due to parts delays and two jobs running beyond estimated time. Valet is the next likely handover bottleneck.",
  "Sales has six warm enquiries with two silent customers needing follow-up before close of business.",
  "Retail prep can recover one go-live vehicle today if missing media is completed before 15:30.",
];

export const mockCustomerMessages = [
  {
    customer: "Mrs Taylor",
    context: "Job 48291 - Swift SZ-T",
    draft: "Your vehicle inspection is complete and the approved brake work is now underway. We expect to update you again by 15:30 once the road test is complete.",
  },
  {
    customer: "Mr Khan",
    context: "Sales enquiry - Vitara automatic",
    draft: "Thanks for your enquiry. We have a Vitara automatic available to view, and we can reserve a test drive slot for Saturday morning if convenient.",
  },
];

export const mockManagerSummary = {
  title: "Manager Summary - Mock 17:00 Brief",
  lines: [
    "Workshop completed 14 jobs, with 3 still at risk due to parts or ramp timing.",
    "Valet has 8 vehicles queued and should prioritise two collection handovers before retail prep cleans.",
    "Sales has GBP 4,800 estimated opportunity in overdue follow-ups and warm VHC authorisations.",
    "Tomorrow is forecast as high pressure because MOT bay utilisation and collection volume overlap.",
  ],
};

export const roadmapStages = [
  "Stage 1: mock-only Vision section",
  "Stage 2: workflow event mapping",
  "Stage 3: rule-based summaries",
  "Stage 4: internal messaging automation",
  "Stage 5: smart queues",
  "Stage 6: department dashboards",
  "Stage 7: scoring engines",
  "Stage 8: historical learning systems",
  "Stage 9: optional model-powered analysis",
  "Stage 10: full dealership coordination layer",
];

export const futurePlatformDescriptions = [
  "Unifies workshop, service, sales, parts, prep, valet, finance, and management into one operating view so every department sees the state that affects its next action.",
  "Keeps departments aware of blockers, handovers, parts movement, valet readiness, collection risk, and customer communication without relying on manual chasing.",
  "Uses dealership patterns to forecast delay risk, capacity pressure, conversion opportunity, prep risk, and customer follow-up priority before they become urgent.",
  "Records which suggestions were accepted, ignored, edited, or resolved so future workflows can become more accurate from real dealership outcomes.",
  "Creates consistent operational scores for delay, approval probability, prep readiness, margin risk, department pressure, and handover readiness.",
  "Turns state changes into routed work: parts arrived, workshop complete, valet ready, finance approved, customer replied, or a vehicle moved stage.",
  "Maps prerequisites between departments so blocked collections, missing keys, incomplete media, unpaid invoices, and open approvals are visible early.",
  "Shows current and forecast pressure across people, ramps, bays, parking, valet capacity, MOT slots, advisor queues, and sales handovers.",
  "Acts as the dealership coordination layer: events flow in, dependencies are checked, suggestions are made, and staff review the next best action.",
  "Builds a structured memory of operational events, decisions, outcomes, and repeated patterns so the platform improves without changing the UI.",
];

export const roadmapStageDetails = [
  "Create the isolated Vision area with mock data, manager-friendly pages, route navigation, and no connection to live DMS records.",
  "Identify the real operational events the DMS already produces, such as status changes, approvals, parts updates, messages, and handovers.",
  "Introduce deterministic summary rules for safe areas first, such as daily manager briefs, job summaries, and collection readiness notes.",
  "Prepare internal message drafts and recipient suggestions from workflow events, keeping every message reviewable before it is sent.",
  "Build ranked queues for valet, approvals, parts chasing, workshop urgency, retail prep, and recovery work using transparent rules.",
  "Give each department a focused dashboard showing only the pressure, alerts, records, and suggestions relevant to its role.",
  "Add reusable scoring primitives for delay risk, approval probability, margin risk, capacity pressure, and handover readiness.",
  "Store historical outcomes so the dealership can compare predictions against what happened and improve future recommendations.",
  "Optionally add model-powered analysis behind the same stable UI labels where summarisation or classification needs more flexibility.",
  "Connect events, queues, summaries, scoring, messages, and management views into one dealership-wide coordination layer.",
];
