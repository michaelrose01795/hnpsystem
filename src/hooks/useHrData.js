// ✅ Imports converted to use absolute alias "@/"
// file location: src/hooks/useHrData.js
import { useEffect, useState } from "react"; // React primitives for managing stateful hooks

function createMockHrOperationsData() {
  const employees = [
    {
      id: "EMP-1",
      userId: 1,
      name: "Jordan Wells",
      jobTitle: "Workshop Supervisor",
      department: "Workshop",
      employmentType: "Full-time",
      hourlyRate: 22.5,
      contractedHours: 40,
      status: "Active",
      startDate: "2022-04-12",
    },
    {
      id: "EMP-2",
      userId: 2,
      name: "Priya Shah",
      jobTitle: "Payroll Specialist",
      department: "Finance",
      employmentType: "Full-time",
      hourlyRate: 19.75,
      contractedHours: 37.5,
      status: "Active",
      startDate: "2021-09-01",
    },
    {
      id: "EMP-3",
      userId: 3,
      name: "Connor James",
      jobTitle: "Service Advisor",
      department: "Service",
      employmentType: "Full-time",
      hourlyRate: 17.2,
      contractedHours: 40,
      status: "On Leave",
      startDate: "2020-06-19",
    },
  ];

  return {
    employeeDirectory: employees,
    attendanceLogs: [
      {
        id: "ATT-1",
        employeeId: "EMP-1",
        employeeName: "Jordan Wells",
        date: "2024-03-18",
        clockIn: "2024-03-18T08:02:00Z",
        clockOut: "2024-03-18T17:01:00Z",
        totalHours: 8.8,
        status: "Clocked Out",
      },
    ],
    overtimeSummaries: [
      {
        id: "OT-1",
        employee: "Jordan Wells",
        userId: 1,
        overtimeHours: 6,
        overtimeRate: 1.5,
        bonus: 30,
        status: "Ready",
        periodStart: "2024-03-01",
        periodEnd: "2024-03-15",
      },
    ],
    leaveRequests: [
      {
        id: "LEAVE-1",
        employee: "Connor James",
        department: "Service",
        type: "Holiday",
        startDate: "2024-04-02",
        endDate: "2024-04-06",
        status: "Pending",
        approver: "Service Manager",
      },
    ],
    leaveBalances: employees.map((employee) => ({
      employee: employee.name,
      employeeId: employee.id,
      department: employee.department,
      entitlement: 25,
      taken: employee.id === "EMP-3" ? 20 : 8,
      remaining: employee.id === "EMP-3" ? 5 : 17,
    })),
    upcomingAbsences: [
      {
        id: "ABS-1",
        employee: "Priya Shah",
        department: "Finance",
        type: "Holiday",
        startDate: "2024-04-10",
        endDate: "2024-04-12",
      },
    ],
    trainingRenewals: [
      {
        id: "TRN-1",
        employee: "Jordan Wells",
        course: "Hybrid Vehicle Safety",
        dueDate: "2024-04-22",
        status: "Due Soon",
      },
      {
        id: "TRN-2",
        employee: "Connor James",
        course: "Customer Experience",
        dueDate: "2024-03-10",
        status: "Overdue",
      },
    ],
    performanceReviews: [
      {
        id: "REV-1",
        employee: "Jordan Wells",
        period: "FY23 Annual",
        reviewer: "Sarah Thompson",
        nextReview: "2024-09-01",
        overall: 4.4,
        ratings: { attendance: 5, productivity: 4, quality: 4, teamwork: 5 },
        developmentFocus: "Coach junior technicians on EV diagnostics.",
      },
    ],
    payRateHistory: [
      {
        id: "PAY-1",
        employee: "Priya Shah",
        effectiveDate: "2024-01-01",
        rate: 19.75,
        type: "Annual Increase",
        approvedBy: "Finance Director",
      },
    ],
    recruitmentPipeline: [],
    staffVehicles: [],
  };
}
export function useHrOperationsData() {
  const [state, setState] = useState({
    data: null, // aggregated HR payload returned from the API
    isLoading: true, // loading indicator for consumers
    error: null, // store any thrown error for debugging and UI messaging
  });

  useEffect(() => {
    let isMounted = true; // track component mount status to prevent state updates after unmount
    const controller = new AbortController(); // allow cancellation when component unmounts

    const load = async () => {
      try {
        const response = await fetch("/api/hr/operations", {
          signal: controller.signal,
          credentials: "include",
        }); // call aggregated HR endpoint

        if (!response.ok) {
          throw new Error(`Failed to load HR data (status ${response.status})`); // bubble HTTP errors for error boundary
        }

        const payload = await response.json(); // parse JSON body
        if (!payload?.success || !payload?.data) {
          throw new Error(payload?.message || "HR data payload malformed"); // ensure shape is as expected
        }

        if (!isMounted) return; // guard against state updates after unmount
        setState({ data: payload.data, isLoading: false, error: null }); // hydrate hook consumers with Supabase data
      } catch (error) {
        if (error.name === "AbortError") return; // ignore abort signals triggered on unmount
        if (!isMounted) return; // bail if component already unmounted
        if (process.env.NODE_ENV !== "production") {
          console.warn("⚠️ Falling back to mock HR operations data", error);
          setState({ data: createMockHrOperationsData(), isLoading: false, error: null });
          return;
        }
        setState({ data: null, isLoading: false, error });
      }
    };

    load(); // kick off data load immediately

    return () => {
      isMounted = false; // mark hook as unmounted
      controller.abort(); // cancel pending fetch to avoid unnecessary work
    };
  }, []);

  return state; // expose aggregated state to consumers
}

/**
 * Real attendance data hook backed by Supabase via /api/hr/attendance.
 */
export function useHrAttendanceData() {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/hr/attendance", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch attendance (${response.status})`);
        }

        const payload = await response.json();
        if (!payload?.success) {
          throw new Error(payload?.message || "Attendance payload malformed");
        }

        setState({
          data: payload.data,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (error.name === "AbortError") return;
        setState({
          data: null,
          isLoading: false,
          error,
        });
      }
    };

    load();
    return () => controller.abort();
  }, []);

  return state;
}

/**
 * Hook for the HR dashboard overview.
 */
export function useHrDashboardData() {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/hr/dashboard", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch HR dashboard (${response.status})`);
        }

        const payload = await response.json();
        if (!payload?.success) {
          throw new Error(payload?.message || "HR dashboard payload malformed");
        }

        setState({
          data: payload.data,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (error.name === "AbortError") return;
        setState({
          data: null,
          isLoading: false,
          error,
        });
      }
    };

    load();
    return () => controller.abort();
  }, []);

  return state;
}

/**
 * Hook for employee directory.
 */
export function useHrEmployeesData() {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/hr/employees", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch employee directory (${response.status})`);
        }

        const payload = await response.json();
        if (!payload?.success) {
          throw new Error(payload?.message || "Employee directory payload malformed");
        }

        setState({
          data: payload.data,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (error.name === "AbortError") return;
        setState({
          data: null,
          isLoading: false,
          error,
        });
      }
    };

    load();
    return () => controller.abort();
  }, []);

  return state;
}
