// file location: src/pages/dashboard.js
// ✅ Imports converted to use absolute alias "@/"
import React, { useEffect, useState } from "react"; // import React and hooks for state handling
import { useRouter } from "next/router"; // import router for navigation
import { useUser } from "@/context/UserContext"; // import user context for authentication data
import { useJobs } from "@/context/JobsContext"; // import jobs context to share job data
import WorkshopManagerDashboard from "@/components/dashboards/WorkshopManagerDashboard"; // import workshop manager dashboard component
import ServiceManagerDashboard from "@/components/dashboards/ServiceManagerDashboard"; // import service manager dashboard
import AfterSalesManagerDashboard from "@/components/dashboards/AfterSalesManagerDashboard"; // import after sales manager dashboard
import RetailManagersDashboard from "@/components/dashboards/RetailManagersDashboard"; // import retail managers dashboard component
import { SearchBar } from "@/components/ui/searchBarAPI";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { ContentWidth, PageShell, SectionShell } from "@/components/ui";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { roleCategories } from "@/config/users"; // import role category definitions
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import DashboardUi from "@/components/page-ui/dashboard-ui"; // Extracted presentation layer.

const retailManagerRoles = (roleCategories?.Retail || [] // build a list of retail manager roles
).filter((roleName) => /manager|director/i.test(roleName)) // keep only manager or director titles
.map((roleName) => roleName.toLowerCase()); // normalize to lowercase for comparison

export default function Dashboard() {
  const { user, loading } = useUser(); // get current user information
  const { jobs, setJobs } = useJobs(); // access shared jobs state
  const router = useRouter(); // initialize router for redirects
  const [showSearch, setShowSearch] = useState(false); // control visibility of search modal
  const [searchTerm, setSearchTerm] = useState(""); // store search term input
  const [searchResults, setSearchResults] = useState([]); // store filtered search results
  const [isRedirecting, setIsRedirecting] = useState(false); // avoid rendering content while routing users

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setIsRedirecting(true);
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return; // stop if user data not ready

    const normalizedRoles = user.roles?.map((role) => role.toLowerCase()) || [];
    const hasRole = (...rolesToMatch) =>
    normalizedRoles.some((roleName) => rolesToMatch.includes(roleName));
    const redirectTo = (path) => {
      setIsRedirecting(true);
      router.replace(path);
    };

    if (hasRole("parts manager")) {
      redirectTo("/parts/manager");
      return;
    }

    if (hasRole("parts")) {
      redirectTo("/dashboard/parts");
      return;
    }

    if (hasRole("techs", "technician", "workshop")) {
      redirectTo("/dashboard/workshop");
      return;
    }

    if (hasRole("manager")) {
      redirectTo("/dashboard/managers");
      return;
    }

    if (isRedirecting) {
      setIsRedirecting(false);
    }
  }, [user, router, isRedirecting]); // re-run redirects when user or router changes

  useEffect(() => {
    const fetchJobs = async () => {
      if (user) {// only fetch when user is available
        const { getAllJobs } = await import("@/lib/database/jobs"); // lazy load jobs helper
        const allJobs = await getAllJobs(); // fetch all jobs from database
        setJobs(allJobs); // store fetched jobs in context
      }
    };
    fetchJobs(); // execute fetch on mount
  }, [user, setJobs]); // re-run when user or setter changes

  if (loading) {
    return <DashboardUi view="section1" />;
  }

  if (!user || isRedirecting) {
    return <DashboardUi view="section2" PageSkeleton={PageSkeleton} />;
  } // do not render until user data exists or when redirecting

  const normalizedRoles = user?.roles?.map((r) => r.toLowerCase()) || []; // normalize roles for checks
  const hasRole = (rolesToMatch = []) =>
  normalizedRoles.some((roleName) => rolesToMatch.includes(roleName)); // helper to match roles
  const isServiceDepartment = hasRole(["service", "service department", "service dept"]);
  const specialDashboardRoles = [
  "workshop manager",
  "service manager",
  "after sales manager",
  "after sales director",
  "aftersales manager"];

  const isWorkshopManager = hasRole(["workshop manager"]); // workshop specific role
  const isServiceManager = hasRole(["service manager"]); // service manager role
  const isAfterSalesManager = hasRole([
  "after sales manager",
  "after sales director",
  "aftersales manager"]
  ); // after sales leadership roles
  const isRetailManager = normalizedRoles.some(
    (roleName) =>
    retailManagerRoles.includes(roleName) &&
    !specialDashboardRoles.includes(roleName) &&
    roleName !== "parts manager" &&
    roleName !== "parts"
  ); // show shared retail dashboard only for remaining roles
  const shouldShowRetailDashboard = isRetailManager || isServiceDepartment;

  if (isWorkshopManager) {
    return <DashboardUi view="section3" WorkshopManagerDashboard={WorkshopManagerDashboard} />;




  }

  if (isServiceManager) {
    return <DashboardUi view="section4" ServiceManagerDashboard={ServiceManagerDashboard} />;




  }

  if (isAfterSalesManager) {
    return <DashboardUi view="section5" AfterSalesManagerDashboard={AfterSalesManagerDashboard} />;




  }

  if (shouldShowRetailDashboard) {// render shared retail/service experience
    return <DashboardUi view="section6" RetailManagersDashboard={RetailManagersDashboard} user={user} />;




  }

  const handleSearch = () => {
    const results = jobs.filter(// filter jobs by search term
      (job) =>
      job.jobNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.reg?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.customer?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setSearchResults(results); // update results state
  };

  return <DashboardUi view="section7" ContentWidth={ContentWidth} DevLayoutSection={DevLayoutSection} handleSearch={handleSearch} jobs={jobs} PageShell={PageShell} popupCardStyles={popupCardStyles} popupOverlayStyles={popupOverlayStyles} SearchBar={SearchBar} searchResults={searchResults} searchTerm={searchTerm} SectionShell={SectionShell} setSearchTerm={setSearchTerm} setShowSearch={setShowSearch} showSearch={showSearch} user={user} />;





































































































































































}
