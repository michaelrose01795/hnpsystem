// file location: src/pages/tech/dashboard.js
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { SectionShell, StatCard } from "@/components/ui";
import { PageSkeleton, InlineLoading } from "@/components/ui/LoadingSkeleton";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";
import { getAllJobs } from "@/lib/database/jobs";
import { getClockingStatus } from "@/lib/database/clocking";
import { prefetchJob } from "@/lib/swr/prefetch";
import TechsDashboardUi from "@/components/page-ui/tech/tech-dashboard-ui"; // Extracted presentation layer.

const pageShellStyle = {
  width: "100%",
  minWidth: 0,
  padding: "8px 0"
};

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
  gap: "12px",
  width: "100%"
};

const actionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
  gap: "12px",
  width: "100%"
};

const jobsListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "12px"
};

const centeredStateStyle = {
  minHeight: "280px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center"
};

const statCardBaseStyle = {
  background: "var(--accent-surface)",
  border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
  boxShadow: "none"
};

const buildToneSurfaceStyle = (surface, border = "var(--accentBorder)") => ({
  ...statCardBaseStyle,
  background: surface
});

const sectionSurfaceStyle = {
  background: "var(--accent-surface)",
  border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
  boxShadow: "none"
};

const emphasizedSectionSurfaceStyle = {
  ...sectionSurfaceStyle
};

const statusBadgeBaseStyle = {
  padding: "6px 12px",
  borderRadius: "var(--radius-sm)",
  fontSize: "12px",
  fontWeight: "600",
  whiteSpace: "nowrap"
};

const getStatusBadgeStyle = (status) => {
  switch (String(status || "").trim().toLowerCase()) {
    case "in progress":
      return {
        ...statusBadgeBaseStyle,
        backgroundColor: "var(--accent-purple-surface)",
        color: "var(--primary)",
        border: "1px solid rgba(var(--accent-base-rgb), 0.2)"
      };
    case "complete":
      return {
        ...statusBadgeBaseStyle,
        backgroundColor: "var(--success-surface)",
        color: "var(--success-text)"
      };
    default:
      return {
        ...statusBadgeBaseStyle,
        backgroundColor: "var(--warning-surface)",
        color: "var(--warning-text)"
      };
  }
};

const formatClockInLabel = (clockInTime) => {
  if (!clockInTime) return "Not currently working";
  return `Since ${new Date(clockInTime).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
};

const buildVehicleLabel = (job) => {
  const reg = job?.reg || "No registration";
  const makeModel = job?.makeModel || "Vehicle details missing";
  return `${reg} - ${makeModel}`;
};

const detailLabelStyle = {
  fontSize: "15px",
  color: "var(--text-primary)",
  margin: 0,
  lineHeight: 1.5
};

const sectionHeadingStyle = {
  fontSize: "20px",
  fontWeight: "700",
  color: "var(--text-primary)",
  margin: 0
};

const sectionCopyStyle = {
  margin: 0,
  fontSize: "14px",
  color: "var(--text-secondary)",
  lineHeight: 1.5
};

export default function TechsDashboard() {
  const router = useRouter();
  const { user, dbUserId } = useUser();
  const { usersByRole, isLoading: rosterLoading } = useRoster();
  const [myJobs, setMyJobs] = useState([]);
  const [nextJob, setNextJob] = useState(null);
  const [currentJob, setCurrentJob] = useState(null);
  const [clockingStatus, setClockingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const techsList = usersByRole?.["Techs"] || [];
  const motList = usersByRole?.["MOT Tester"] || [];
  const allowedNames = new Set([...techsList, ...motList]);
  const username = typeof user?.username === "string" ? user.username.trim() : "";
  const hasTechRole =
  user?.roles?.some((role) => role?.toLowerCase().includes("tech")) || false;
  const isTech = allowedNames.has(username) || hasTechRole;

  const isAssignedToTechnician = useCallback(
    (job) => {
      if (!dbUserId || !job) return false;
      const assignedNumeric =
      typeof job.assignedTo === "number" ?
      job.assignedTo :
      typeof job.assignedTo === "string" ?
      Number(job.assignedTo) :
      null;

      if (assignedNumeric === dbUserId) return true;
      if (job.assignedTech?.id && job.assignedTech.id === dbUserId) return true;
      return false;
    },
    [dbUserId]
  );

  useEffect(() => {
    if (!isTech || !dbUserId) return;

    const fetchData = async () => {
      setLoading(true);

      try {
        const fetchedJobs = await getAllJobs();
        const assignedJobs = fetchedJobs.filter((job) => isAssignedToTechnician(job));
        const sortedJobs = assignedJobs.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          }
          return 0;
        });

        setMyJobs(sortedJobs);
        setNextJob(sortedJobs.length > 0 ? sortedJobs[0] : null);

        const { isClockedIn, data } = await getClockingStatus(dbUserId);
        setClockingStatus(data);
        setCurrentJob(isClockedIn && data ? sortedJobs[0] || null : null);
      } catch (error) {
        console.error("Error fetching tech data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dbUserId, isAssignedToTechnician, isTech]);

  const handleStartJob = useCallback(
    (job) => {
      router.push(`/job-cards/myjobs/${job.jobNumber}`);
    },
    [router]
  );

  const visibleJobs = useMemo(() => myJobs.slice(0, 3), [myJobs]);
  const isClockedIn = Boolean(clockingStatus?.clock_in);
  const clockInTime = clockingStatus?.clock_in || null;
  const dashboardActions = [
  {
    key: "view-all-jobs",
    label: "View All Jobs",
    href: "/job-cards/myjobs"
  },
  {
    key: "time-tracking",
    label: "Time Tracking",
    href: "/tech/efficiency"
  },
  {
    key: "request-consumables",
    label: "Request Consumables",
    href: "/tech/consumables-request"
  }];


  if (rosterLoading) {
    return <TechsDashboardUi view="section1" centeredStateStyle={centeredStateStyle} InlineLoading={InlineLoading} SectionShell={SectionShell} />;










  }

  if (!isTech) {
    return <TechsDashboardUi view="section2" centeredStateStyle={centeredStateStyle} SectionShell={SectionShell} />;















  }

  if (loading) {
    return <TechsDashboardUi view="section3" PageSkeleton={PageSkeleton} />;
  }

  return <TechsDashboardUi view="section4" actionGridStyle={actionGridStyle} buildToneSurfaceStyle={buildToneSurfaceStyle} buildVehicleLabel={buildVehicleLabel} calculateHoursWorked={calculateHoursWorked} clockInTime={clockInTime} currentJob={currentJob} dashboardActions={dashboardActions} detailLabelStyle={detailLabelStyle} DevLayoutSection={DevLayoutSection} emphasizedSectionSurfaceStyle={emphasizedSectionSurfaceStyle} formatClockInLabel={formatClockInLabel} getStatusBadgeStyle={getStatusBadgeStyle} handleStartJob={handleStartJob} isClockedIn={isClockedIn} jobsListStyle={jobsListStyle} myJobs={myJobs} nextJob={nextJob} pageShellStyle={pageShellStyle} prefetchJob={prefetchJob} router={router} sectionCopyStyle={sectionCopyStyle} sectionHeadingStyle={sectionHeadingStyle} SectionShell={SectionShell} sectionSurfaceStyle={sectionSurfaceStyle} StatCard={StatCard} statsGridStyle={statsGridStyle} visibleJobs={visibleJobs} />;
























































































































































































































































































































































































}

function calculateHoursWorked(clockInTime) {
  if (!clockInTime) return "0.0";
  const now = new Date();
  const clockIn = new Date(clockInTime);
  const hours = (now - clockIn) / (1000 * 60 * 60);
  return hours.toFixed(1);
}
