import { rows as baseEmployees } from "./hr_employees";

const today = "2026-05-21";
const periodStart = "2026-04-26";
const periodEnd = "2026-05-25";

const employeeProfiles = [
  {
    id: "EMP-001",
    userId: 1,
    name: "Amelia Hart",
    jobTitle: "Senior Technician",
    department: "Workshop",
    role: "Technician",
    employmentType: "Full-time",
    status: "Active",
    startDate: "2022-04-04",
    probationEnd: "2022-10-04",
    contractedHours: 40,
    hourlyRate: 21.5,
    overtimeRate: 32.25,
    annualSalary: 44720,
    payrollNumber: "HNP-001",
    nationalInsurance: "QQ123456C",
    keycloakId: "kc-amelia.hart",
    email: "amelia.hart@hnp.example",
    phone: "07700 800001",
    emergencyContact: "Megan Hart, 07700 900001, Partner",
    address: "14 Matford Lane, Exeter",
    lineManagerIds: [2],
    lineManagers: [{ userId: 2, name: "Daniel Price" }],
    documents: [
      { id: "DOC-001", name: "Contract", type: "employment", uploadedOn: "2022-04-01" },
      { id: "DOC-002", name: "MOT certificate", type: "qualification", uploadedOn: "2026-01-18" },
    ],
  },
  {
    id: "EMP-002",
    userId: 2,
    name: "Daniel Price",
    jobTitle: "Workshop Manager",
    department: "Workshop",
    role: "Manager",
    employmentType: "Full-time",
    status: "Active",
    startDate: "2018-08-12",
    probationEnd: "2019-02-12",
    contractedHours: 40,
    hourlyRate: 28.75,
    overtimeRate: 43.13,
    annualSalary: 59800,
    payrollNumber: "HNP-002",
    nationalInsurance: "QQ223456C",
    keycloakId: "kc-daniel.price",
    email: "daniel.price@hnp.example",
    phone: "07700 800002",
    emergencyContact: "Laura Price, 07700 900002, Spouse",
    address: "8 Clyst Road, Exeter",
    lineManagerIds: [],
    lineManagers: [],
    documents: [{ id: "DOC-003", name: "Management training", type: "qualification", uploadedOn: "2025-09-02" }],
  },
  {
    id: "EMP-003",
    userId: 3,
    name: "Sofia Reed",
    jobTitle: "Service Advisor",
    department: "Front of House",
    role: "Service Advisor",
    employmentType: "Full-time",
    status: "Active",
    startDate: "2024-01-10",
    probationEnd: "2024-07-10",
    contractedHours: 37.5,
    hourlyRate: 17.25,
    overtimeRate: 25.88,
    annualSalary: 33638,
    payrollNumber: "HNP-003",
    nationalInsurance: "QQ323456C",
    keycloakId: "kc-sofia.reed",
    email: "sofia.reed@hnp.example",
    phone: "07700 800003",
    emergencyContact: "Nina Reed, 07700 900003, Sister",
    address: "22 Countess Wear Road, Exeter",
    lineManagerIds: [2],
    lineManagers: [{ userId: 2, name: "Daniel Price" }],
    documents: [{ id: "DOC-004", name: "Customer care certificate", type: "training", uploadedOn: "2026-03-10" }],
  },
  {
    id: "EMP-004",
    userId: 4,
    name: "Marcus Bell",
    jobTitle: "Parts Advisor",
    department: "Parts",
    role: "Parts",
    employmentType: "Full-time",
    status: "On leave",
    startDate: "2023-06-01",
    probationEnd: "2023-12-01",
    contractedHours: 40,
    hourlyRate: 18.4,
    overtimeRate: 27.6,
    annualSalary: 38272,
    payrollNumber: "HNP-004",
    nationalInsurance: "QQ423456C",
    keycloakId: "kc-marcus.bell",
    email: "marcus.bell@hnp.example",
    phone: "07700 800004",
    emergencyContact: "Ellie Bell, 07700 900004, Partner",
    address: "5 Marsh Barton Road, Exeter",
    lineManagerIds: [2],
    lineManagers: [{ userId: 2, name: "Daniel Price" }],
    documents: [{ id: "DOC-005", name: "Forklift certificate", type: "qualification", uploadedOn: "2025-11-26" }],
  },
  {
    id: "EMP-005",
    userId: 5,
    name: "Priya Shah",
    jobTitle: "MOT Tester",
    department: "MOT",
    role: "MOT Tester",
    employmentType: "Full-time",
    status: "Active",
    startDate: "2020-03-15",
    probationEnd: "2020-09-15",
    contractedHours: 40,
    hourlyRate: 22.75,
    overtimeRate: 34.13,
    annualSalary: 47320,
    payrollNumber: "HNP-005",
    nationalInsurance: "QQ523456C",
    keycloakId: "kc-priya.shah",
    email: "priya.shah@hnp.example",
    phone: "07700 800005",
    emergencyContact: "Ravi Shah, 07700 900005, Brother",
    address: "19 Topsham Road, Exeter",
    lineManagerIds: [2],
    lineManagers: [{ userId: 2, name: "Daniel Price" }],
    documents: [{ id: "DOC-006", name: "MOT annual assessment", type: "qualification", uploadedOn: "2026-02-04" }],
  },
  {
    id: "EMP-006",
    userId: 6,
    name: "Owen Clarke",
    jobTitle: "Body Shop Technician",
    department: "Body Shop",
    role: "Technician",
    employmentType: "Full-time",
    status: "Active",
    startDate: "2021-11-22",
    probationEnd: "2022-05-22",
    contractedHours: 40,
    hourlyRate: 20.1,
    overtimeRate: 30.15,
    annualSalary: 41808,
    payrollNumber: "HNP-006",
    nationalInsurance: "QQ623456C",
    keycloakId: "kc-owen.clarke",
    email: "owen.clarke@hnp.example",
    phone: "07700 800006",
    emergencyContact: "Grace Clarke, 07700 900006, Partner",
    address: "3 Alphington Street, Exeter",
    lineManagerIds: [2],
    lineManagers: [{ userId: 2, name: "Daniel Price" }],
    documents: [{ id: "DOC-007", name: "Paint systems certificate", type: "qualification", uploadedOn: "2025-08-12" }],
  },
  {
    id: "EMP-007",
    userId: 7,
    name: "Liam Foster",
    jobTitle: "Valeter",
    department: "Valeting",
    role: "Valeting",
    employmentType: "Part-time",
    status: "Active",
    startDate: "2025-02-03",
    probationEnd: "2025-08-03",
    contractedHours: 24,
    hourlyRate: 13.25,
    overtimeRate: 19.88,
    annualSalary: 16536,
    payrollNumber: "HNP-007",
    nationalInsurance: "QQ723456C",
    keycloakId: "kc-liam.foster",
    email: "liam.foster@hnp.example",
    phone: "07700 800007",
    emergencyContact: "Hannah Foster, 07700 900007, Parent",
    address: "27 Cowick Lane, Exeter",
    lineManagerIds: [2],
    lineManagers: [{ userId: 2, name: "Daniel Price" }],
    documents: [{ id: "DOC-008", name: "COSHH induction", type: "training", uploadedOn: "2025-02-07" }],
  },
  {
    id: "EMP-008",
    userId: 8,
    name: "Noah Martin",
    jobTitle: "Mobile Technician",
    department: "Mobile",
    role: "Technician",
    employmentType: "Full-time",
    status: "Active",
    startDate: "2023-09-01",
    probationEnd: "2024-03-01",
    contractedHours: 40,
    hourlyRate: 21.9,
    overtimeRate: 32.85,
    annualSalary: 45552,
    payrollNumber: "HNP-008",
    nationalInsurance: "QQ823456C",
    keycloakId: "kc-noah.martin",
    email: "noah.martin@hnp.example",
    phone: "07700 800008",
    emergencyContact: "Maya Martin, 07700 900008, Partner",
    address: "11 Pinhoe Road, Exeter",
    lineManagerIds: [2],
    lineManagers: [{ userId: 2, name: "Daniel Price" }],
    documents: [{ id: "DOC-009", name: "EV awareness", type: "training", uploadedOn: "2026-04-12" }],
  },
];

const attendanceLogs = employeeProfiles.flatMap((employee, index) => {
  const shiftStart = index % 3 === 0 ? "07:45" : index % 3 === 1 ? "08:00" : "08:15";
  const shiftEnd = index % 2 === 0 ? "16:30" : "17:00";
  return [
    {
      id: `${employee.id}-att-today`,
      employeeId: employee.id,
      employeeName: employee.name,
      employee: employee.name,
      userId: employee.userId,
      date: today,
      clockIn: `${today}T${shiftStart}:00.000Z`,
      clockOut: employee.status === "On leave" ? null : `${today}T${shiftEnd}:00.000Z`,
      totalHours: employee.status === "On leave" ? 0 : index % 2 === 0 ? 8 : 8.5,
      status: employee.status === "On leave" ? "Annual Leave" : "On Time",
      type: "Weekday",
    },
    {
      id: `${employee.id}-att-overtime`,
      employeeId: employee.id,
      employeeName: employee.name,
      employee: employee.name,
      userId: employee.userId,
      date: "2026-05-20",
      clockIn: "2026-05-20T17:00:00.000Z",
      clockOut: "2026-05-20T19:00:00.000Z",
      totalHours: index % 2 === 0 ? 2 : 1.5,
      status: "Overtime",
      type: "Overtime",
    },
  ];
});

const absenceRecords = [
  {
    id: "LR-1001",
    employeeId: "EMP-004",
    employee: "Marcus Bell",
    department: "Parts",
    type: "Annual Leave",
    startDate: "2026-05-20",
    endDate: "2026-05-24",
    status: "Approved",
    approvalStatus: "Approved",
    submittedOn: "2026-04-18T10:20:00.000Z",
    approver: "Daniel Price",
    requestNotes: "Family holiday booked outside peak MOT cover.",
  },
  {
    id: "LR-1002",
    employeeId: "EMP-003",
    employee: "Sofia Reed",
    department: "Front of House",
    type: "Annual Leave",
    startDate: "2026-06-08",
    endDate: "2026-06-12",
    status: "Pending",
    approvalStatus: "Pending",
    submittedOn: "2026-05-15T09:10:00.000Z",
    approver: "Awaiting approval",
    requestNotes: "Requested for school half-term coverage.",
  },
  {
    id: "LR-1003",
    employeeId: "EMP-005",
    employee: "Priya Shah",
    department: "MOT",
    type: "Training",
    startDate: "2026-06-03",
    endDate: "2026-06-04",
    status: "Scheduled",
    approvalStatus: "Approved",
    submittedOn: "2026-05-02T13:45:00.000Z",
    approver: "Daniel Price",
    requestNotes: "DVSA annual assessment workshop.",
  },
  {
    id: "LR-1004",
    employeeId: "EMP-007",
    employee: "Liam Foster",
    department: "Valeting",
    type: "Annual Leave",
    startDate: "2026-05-28",
    endDate: "2026-05-30",
    status: "Pending",
    approvalStatus: "Pending",
    submittedOn: "2026-05-19T14:05:00.000Z",
    approver: "Awaiting approval",
    requestNotes: "Short notice request; needs valeting cover.",
  },
];

const leaveBalances = employeeProfiles.map((employee, index) => {
  const entitlement = employee.employmentType === "Part-time" ? 15 : 25;
  const taken = [7, 4, 3, 8, 5, 6, 2, 4][index] ?? 4;
  return {
    employeeId: employee.id,
    employee: employee.name,
    department: employee.department,
    entitlement,
    taken,
    used: taken,
    remaining: Math.max(entitlement - taken, 0),
  };
});

const overtimeSummaries = employeeProfiles.map((employee, index) => ({
  id: employee.userId,
  userId: employee.userId,
  employee: employee.name,
  periodStart,
  periodEnd,
  overtimeHours: [6.5, 3, 2, 4.5, 7, 5, 1.5, 6][index] ?? 2,
  overtimeRate: employee.overtimeRate,
  bonus: [32.5, 15, 10, 22.5, 35, 25, 7.5, 30][index] ?? 10,
  status: index % 3 === 0 ? "Ready" : "In Progress",
}));

const payRateHistory = [
  { id: "PAY-001", employeeId: "EMP-001", employee: "Amelia Hart", effectiveDate: "2026-04-01", rate: 21.5, type: "Annual review", approvedBy: "Daniel Price" },
  { id: "PAY-002", employeeId: "EMP-005", employee: "Priya Shah", effectiveDate: "2026-04-01", rate: 22.75, type: "Qualification uplift", approvedBy: "Daniel Price" },
  { id: "PAY-003", employeeId: "EMP-007", employee: "Liam Foster", effectiveDate: "2026-03-01", rate: 13.25, type: "Probation passed", approvedBy: "Daniel Price" },
  { id: "PAY-004", employeeId: "EMP-008", employee: "Noah Martin", effectiveDate: "2026-02-01", rate: 21.9, type: "Mobile premium", approvedBy: "Daniel Price" },
];

const payRiseRequests = [
  { id: "PR-001", employee: "Amelia Hart", currentRate: 20.5, requestedRate: 21.5, approver: "Daniel Price", status: "Approved" },
  { id: "PR-002", employee: "Owen Clarke", currentRate: 19.25, requestedRate: 20.1, approver: "Daniel Price", status: "Pending" },
  { id: "PR-003", employee: "Liam Foster", currentRate: 12.75, requestedRate: 13.25, approver: "Daniel Price", status: "Approved" },
];

const performanceReviews = [
  {
    id: "REV-001",
    employee: "Amelia Hart",
    reviewer: "Daniel Price",
    period: "Q2 2026",
    nextReview: "2026-06-14T10:00:00.000Z",
    overall: 4.6,
    ratings: { attendance: 5, productivity: 5, quality: 4, teamwork: 4 },
    status: "scheduled",
    developmentFocus: "Document diagnostic notes more consistently for complex electrical jobs.",
  },
  {
    id: "REV-002",
    employee: "Sofia Reed",
    reviewer: "Daniel Price",
    period: "Q2 2026",
    nextReview: "2026-06-18T14:00:00.000Z",
    overall: 4.2,
    ratings: { attendance: 4, productivity: 4, quality: 4, teamwork: 5 },
    status: "scheduled",
    developmentFocus: "Shadow accounts handover process before taking more warranty invoice queries.",
  },
  {
    id: "REV-003",
    employee: "Owen Clarke",
    reviewer: "Daniel Price",
    period: "Q2 2026",
    nextReview: "2026-06-21T09:30:00.000Z",
    overall: 3.8,
    ratings: { attendance: 4, productivity: 4, quality: 4, teamwork: 3 },
    status: "draft",
    developmentFocus: "Pair with senior tech for estimating refinishing hours on insurance work.",
  },
  {
    id: "REV-004",
    employee: "Noah Martin",
    reviewer: "Daniel Price",
    period: "Q2 2026",
    nextReview: "2026-07-02T11:00:00.000Z",
    overall: 4.4,
    ratings: { attendance: 5, productivity: 4, quality: 4, teamwork: 5 },
    status: "scheduled",
    developmentFocus: "Prepare route-efficiency notes from mobile work for wider workshop planning.",
  },
];

const trainingRenewals = [
  { id: "TRN-001", course: "MOT Tester annual assessment", employee: "Priya Shah", dueDate: "2026-06-04", status: "Due Soon" },
  { id: "TRN-002", course: "EV high-voltage awareness", employee: "Noah Martin", dueDate: "2026-06-18", status: "Due Soon" },
  { id: "TRN-003", course: "COSHH refresher", employee: "Liam Foster", dueDate: "2026-05-18", status: "Overdue" },
  { id: "TRN-004", course: "First Aid at Work", employee: "Sofia Reed", dueDate: "2026-08-02", status: "On Track" },
  { id: "TRN-005", course: "Hybrid systems Level 3", employee: "Amelia Hart", dueDate: "2026-09-15", status: "On Track" },
];

const trainingCatalogue = [
  { id: "CAT-001", title: "MOT Tester annual assessment", duration: "6 hours", mandatory: "MOT team", status: "Active" },
  { id: "CAT-002", title: "EV high-voltage awareness", duration: "8 hours", mandatory: "Workshop and mobile", status: "Active" },
  { id: "CAT-003", title: "COSHH refresher", duration: "2 hours", mandatory: "All workshop staff", status: "Active" },
  { id: "CAT-004", title: "First Aid at Work", duration: "16 hours", mandatory: "Named first aiders", status: "Active" },
];

const trainingCompliance = [
  { id: "CMP-001", department: "Workshop", compliance: 88, status: "On track" },
  { id: "CMP-002", department: "MOT", compliance: 96, status: "On track" },
  { id: "CMP-003", department: "Valeting", compliance: 72, status: "Behind" },
  { id: "CMP-004", department: "Parts", compliance: 84, status: "Watch" },
];

const activeWarnings = [
  { id: "DISC-001", employee: "Owen Clarke", department: "Body Shop", warningLevel: "Verbal Warning", level: "Verbal Warning", incidentDate: "2026-05-09", issuedOn: "2026-05-09", status: "Follow-up due", notes: "Missed PPE sign-off; refresher booked." },
  { id: "DISC-002", employee: "Liam Foster", department: "Valeting", warningLevel: "Incident Report", level: "Incident Report", incidentDate: "2026-05-12", issuedOn: "2026-05-12", status: "Monitoring", notes: "Vehicle handover checklist skipped during busy collection window." },
  { id: "DISC-003", employee: "Marcus Bell", department: "Parts", warningLevel: "Written Warning", level: "Written Warning", incidentDate: "2026-04-28", issuedOn: "2026-04-28", status: "Open", notes: "Repeat late supplier-order confirmation." },
];

const incidentLog = [
  { id: "INC-101", incidentType: "PPE compliance", jobNumber: "J-12684", recordedBy: "Daniel Price", outcome: "Refresher assigned", date: "2026-05-09" },
  { id: "INC-102", incidentType: "Process missed", jobNumber: "J-12691", recordedBy: "Sofia Reed", outcome: "Manager review", date: "2026-05-12" },
  { id: "INC-103", incidentType: "Timekeeping", jobNumber: "Internal", recordedBy: "Daniel Price", outcome: "Monitoring", date: "2026-05-16" },
];

const openRoles = [
  { id: "ROLE-001", title: "Service Advisor", department: "Front of House", applicantCount: 12, stage: "Interviewing", postedDate: "2026-05-03" },
  { id: "ROLE-002", title: "Apprentice Technician", department: "Workshop", applicantCount: 18, stage: "Shortlisting", postedDate: "2026-04-26" },
  { id: "ROLE-003", title: "Parts Driver", department: "Parts", applicantCount: 6, stage: "Offer pending", postedDate: "2026-05-08" },
];

const recruitmentTasks = [
  { id: "TASK-001", role: "Service Advisor", description: "Confirm second interview panel", owner: "Sofia Reed", dueDate: "2026-05-23", status: "Due" },
  { id: "TASK-002", role: "Apprentice Technician", description: "Score practical assessments", owner: "Daniel Price", dueDate: "2026-05-24", status: "In progress" },
  { id: "TASK-003", role: "Parts Driver", description: "Prepare offer letter", owner: "Marcus Bell", dueDate: "2026-05-22", status: "Ready" },
];

const applicants = [
  { id: "APP-001", name: "Harriet Jones", role: "Service Advisor", stage: "Second interview", lastUpdate: "2026-05-20", owner: "Sofia Reed" },
  { id: "APP-002", name: "Callum Finch", role: "Apprentice Technician", stage: "Practical test", lastUpdate: "2026-05-19", owner: "Daniel Price" },
  { id: "APP-003", name: "Mina Patel", role: "Parts Driver", stage: "Offer", lastUpdate: "2026-05-21", owner: "Marcus Bell" },
];

const onboardingTasks = [
  { id: "ONB-001", task: "Create login and email account", owner: "HR", status: "Template ready" },
  { id: "ONB-002", task: "Issue PPE and locker", owner: "Workshop Manager", status: "Required" },
  { id: "ONB-003", task: "Book induction and safety tour", owner: "Line Manager", status: "Required" },
  { id: "ONB-004", task: "Assign mandatory training", owner: "HR", status: "Automatic" },
];

const reportMetrics = [
  { id: "MET-001", label: "Scheduled exports", value: 6, detail: "2 weekly, 4 monthly" },
  { id: "MET-002", label: "Reports generated (30d)", value: 34, detail: "Payroll and absence most used" },
  { id: "MET-003", label: "Downloads (30d)", value: 51, detail: "CSV preferred by accounts" },
  { id: "MET-004", label: "Alerts triggered", value: 5, detail: "Training and leave cover" },
];

const reportCatalogue = [
  { id: "REP-001", title: "Headcount by department", description: "Active employees, starters, leavers and contract types.", formats: "CSV, Excel, PDF" },
  { id: "REP-002", title: "Absence summary", description: "Leave, sickness and unpaid absence by team and date range.", formats: "CSV, PDF" },
  { id: "REP-003", title: "Training compliance", description: "Mandatory certificates, overdue renewals and department compliance.", formats: "Excel, PDF" },
  { id: "REP-004", title: "Overtime trend", description: "Approved overtime hours and payroll cost by pay period.", formats: "CSV, Excel" },
];

const policyDocuments = [
  { id: "POL-001", title: "Health & Safety Handbook", category: "Health & Safety", owner: "HR", updatedAt: "2026-04-22", status: "Published" },
  { id: "POL-002", title: "Employee Handbook", category: "Employee Handbook", owner: "HR", updatedAt: "2026-03-18", status: "Published" },
  { id: "POL-003", title: "Code of Conduct", category: "Code of Conduct", owner: "HR", updatedAt: "2026-02-10", status: "Review due" },
];

const accessMatrix = [
  { id: "ACC-001", role: "HR Manager", modules: "All HR modules", access: "Full access" },
  { id: "ACC-002", role: "Admin Manager", modules: "Dashboard, records, leave, reports", access: "Manage" },
  { id: "ACC-003", role: "Department Manager", modules: "Attendance, leave, performance", access: "Team only" },
  { id: "ACC-004", role: "Employee", modules: "Own profile, leave requests, training", access: "Self-service" },
];

const departmentPerformance = [
  { id: "dept-workshop", department: "Workshop", productivity: 91, quality: 88, teamwork: 86 },
  { id: "dept-front", department: "Front of House", productivity: 84, quality: 90, teamwork: 92 },
  { id: "dept-parts", department: "Parts", productivity: 87, quality: 85, teamwork: 83 },
  { id: "dept-mot", department: "MOT", productivity: 93, quality: 91, teamwork: 88 },
];

export const hrPresentationData = {
  today,
  employeeDirectory: employeeProfiles,
  attendanceLogs,
  absenceRecords,
  overtimeSummaries,
  payRateHistory,
  payRiseRequests,
  leaveRequests: absenceRecords,
  leaveBalances,
  upcomingAbsences: absenceRecords,
  performanceReviews,
  trainingRenewals,
  trainingCatalogue,
  trainingCompliance,
  activeWarnings,
  incidentLog,
  openRoles,
  recruitmentTasks,
  applicants,
  onboardingTasks,
  reportMetrics,
  reportCatalogue,
  policyDocuments,
  accessMatrix,
  departmentPerformance,
  hrDashboardMetrics: [
    { id: "totalEmployees", label: "Total Employees", icon: "people", active: employeeProfiles.filter((employee) => employee.status === "Active").length, inactive: employeeProfiles.filter((employee) => employee.status !== "Active").length },
    { id: "attendanceRate", label: "Attendance Rate", icon: "clock", value: "92%", trend: "+3%" },
    { id: "performanceScore", label: "Performance Score", icon: "chart", value: "4.3 / 5", trend: "+0.2" },
    { id: "trainingCompliance", label: "Training Compliance", icon: "training", value: "86%", trend: "-4%" },
  ],
  staffVehicles: [],
};

export function getPresentationEmployeeRows() {
  return employeeProfiles.map((employee, index) => ({
    ...baseEmployees[index],
    ...employee,
    user_id: employee.userId,
    first_name: employee.name.split(" ")[0],
    last_name: employee.name.split(" ").slice(1).join(" "),
    full_name: employee.name,
    employee_number: employee.id,
    job_title: employee.jobTitle,
    employment_type: employee.employmentType,
    employment_status: employee.status,
    start_date: employee.startDate,
    probation_end: employee.probationEnd,
    contracted_hours: employee.contractedHours,
    hourly_rate: employee.hourlyRate,
    overtime_rate: employee.overtimeRate,
    annual_salary: employee.annualSalary,
    payroll_reference: employee.payrollNumber,
    national_insurance_number: employee.nationalInsurance,
    home_address: employee.address,
    is_active: employee.status !== "Terminated",
  }));
}

export function buildHrOperationsMock() {
  return { ...hrPresentationData };
}

export function buildHrAttendanceMock() {
  return {
    attendanceLogs,
    overtimeSummaries,
    absenceRecords,
  };
}
