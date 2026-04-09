// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/api/hr/dashboard.js
import { getHrDashboardSnapshot } from "@/lib/database/hr";
import { withRoleGuard } from "@/lib/auth/roleGuard"; // Role-based access control wrapper.
import { HR_CORE_ROLES } from "@/lib/auth/roles"; // Allowed roles for HR endpoints.

function createMockHrDashboardSnapshot() {
  const today = new Date();
  const formatDate = (offsetDays) => {
    const date = new Date(today);
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString();
  };

  return {
    hrDashboardMetrics: [
      {
        id: "totalEmployees",
        label: "Total Employees",
        icon: "👥",
        active: 42,
        inactive: 5,
      },
      {
        id: "attendanceRate",
        label: "Attendance Rate",
        icon: "🕒",
        value: "92%",
        trend: "+4%",
      },
      {
        id: "performanceScore",
        label: "Performance Score",
        icon: "📈",
        value: "4.3 / 5",
        trend: "+0.2",
      },
      {
        id: "trainingCompliance",
        label: "Training Compliance",
        icon: "🎓",
        value: "78%",
        trend: "-3%",
      },
    ],
    upcomingAbsences: [
      {
        id: "mock-absence-1",
        employee: "Jordan Wells",
        department: "Operations",
        type: "Holiday",
        startDate: formatDate(2),
        endDate: formatDate(6),
      },
      {
        id: "mock-absence-2",
        employee: "Priya Shah",
        department: "Finance",
        type: "Parental Leave",
        startDate: formatDate(10),
        endDate: formatDate(30),
      },
    ],
    activeWarnings: [
      {
        id: "mock-warning-1",
        employee: "Marcus Lee",
        department: "Warehouse",
        level: "Final Warning",
        issuedOn: formatDate(-12),
        notes: "Repeated safety violations during forklift operation.",
      },
      {
        id: "mock-warning-2",
        employee: "Sophie Turner",
        department: "Customer Support",
        level: "Written Warning",
        issuedOn: formatDate(-5),
        notes: "Escalated customer complaint awaiting resolution.",
      },
    ],
    departmentPerformance: [
      { id: "ops", department: "Operations", productivity: 88, quality: 82, teamwork: 90 },
      { id: "sales", department: "Sales", productivity: 76, quality: 74, teamwork: 81 },
      { id: "engineering", department: "Engineering", productivity: 91, quality: 89, teamwork: 85 },
    ],
    trainingRenewals: [
      {
        id: "mock-renewal-1",
        employee: "Hannah Patel",
        course: "First Aid Level 2",
        dueDate: formatDate(7),
        status: "Due Soon",
      },
      {
        id: "mock-renewal-2",
        employee: "Connor James",
        course: "Manual Handling",
        dueDate: formatDate(-3),
        status: "Overdue",
      },
    ],
  };
}

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const data = await getHrDashboardSnapshot();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ /api/hr/dashboard error", error);
    if (process.env.NODE_ENV !== "production") {
      console.warn("⚠️ Returning mock HR dashboard snapshot in development.");
      return res.status(200).json({ success: true, data: createMockHrDashboardSnapshot(), mock: true });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to load HR dashboard data",
      error: error.message,
    });
  }
}

export default withRoleGuard(handler, { allow: HR_CORE_ROLES }); // Protect route with HR role check.
