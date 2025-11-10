// file location: src/hooks/useHrData.js
import { useEffect, useState } from "react";
import {
  hrDashboardMetrics as mockHrDashboardMetrics,
  upcomingAbsences as mockUpcomingAbsences,
  activeWarnings as mockActiveWarnings,
  departmentPerformance as mockDepartmentPerformance,
  trainingRenewals as mockTrainingRenewals,
  employeeDirectory as mockEmployeeDirectory,
  attendanceLogs as mockAttendanceLogs,
  absenceRecords as mockAbsenceRecords,
  overtimeSummaries as mockOvertimeSummaries,
  payRateHistory as mockPayRateHistory,
  leaveRequests as mockLeaveRequests,
  leaveBalances as mockLeaveBalances,
} from "../lib/hr/mockData";

/**
 * Placeholder data loader for the HR module.
 *
 * TODO: Replace this hook with a Supabase-backed data fetcher once HR APIs are ready.
 */
export function useHrMockData() {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/hr/mock-data", {
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            if (isMounted) {
              setState({
                data: getLocalMockData(),
                isLoading: false,
                error: null,
              });
            }
            return;
          }
          throw new Error(`Failed to load HR mock data (status ${response.status})`);
        }

        const payload = await response.json();
        if (!payload?.success) {
          throw new Error(payload?.message || "HR mock data returned an unexpected shape");
        }

        if (isMounted) {
          setState({
            data: payload.data,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (error.name === "AbortError") return;
        if (isMounted) {
          setState({
            data: getLocalMockData(),
            isLoading: false,
            error: null,
          });
        }
      }
    };

    load();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  return state;
}

function getLocalMockData() {
  return {
    hrDashboardMetrics: mockHrDashboardMetrics,
    upcomingAbsences: mockUpcomingAbsences,
    activeWarnings: mockActiveWarnings,
    departmentPerformance: mockDepartmentPerformance,
    trainingRenewals: mockTrainingRenewals,
    employeeDirectory: mockEmployeeDirectory,
    attendanceLogs: mockAttendanceLogs,
    absenceRecords: mockAbsenceRecords,
    overtimeSummaries: mockOvertimeSummaries,
    payRateHistory: mockPayRateHistory,
    leaveRequests: mockLeaveRequests,
    leaveBalances: mockLeaveBalances,
  };
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
