// file location: src/pages/api/hr/mock-data.js

import {
  hrDashboardMetrics,
  upcomingAbsences,
  activeWarnings,
  departmentPerformance,
  trainingRenewals,
  employeeDirectory,
  attendanceLogs,
  absenceRecords,
  overtimeSummaries,
  payRateHistory,
  leaveRequests,
  leaveBalances,
} from "../../../lib/hr/mockData";
import { withRoleGuard } from "../../../lib/auth/roleGuard";
import { HR_CORE_ROLES, MANAGER_SCOPED_ROLES } from "../../../lib/auth/roles";

const ALLOWED_ROLES = Array.from(
  new Set([...HR_CORE_ROLES, ...MANAGER_SCOPED_ROLES].map((role) => role.toLowerCase()))
);

const handler = (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      hrDashboardMetrics,
      upcomingAbsences,
      activeWarnings,
      departmentPerformance,
      trainingRenewals,
      employeeDirectory,
      attendanceLogs,
      absenceRecords,
      overtimeSummaries,
      payRateHistory,
      leaveRequests,
      leaveBalances,
    },
  });
};

export default withRoleGuard(handler, { allow: ALLOWED_ROLES });
