// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/dashboard.js
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
import { PageContentSkeleton } from "@/components/ui/LoadingSkeleton";
import { roleCategories } from "@/config/users"; // import role category definitions
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";

const retailManagerRoles = (roleCategories?.Retail || []) // build a list of retail manager roles
  .filter((roleName) => /manager|director/i.test(roleName)) // keep only manager or director titles
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
      if (user) { // only fetch when user is available
        const { getAllJobs } = await import("@/lib/database/jobs"); // lazy load jobs helper
        const allJobs = await getAllJobs(); // fetch all jobs from database
        setJobs(allJobs); // store fetched jobs in context
      }
    };
    fetchJobs(); // execute fetch on mount
  }, [user, setJobs]); // re-run when user or setter changes

  if (loading) {
    return null;
  }

  if (!user || isRedirecting) {
    return (
      <>
        <PageContentSkeleton route={router.asPath || "/dashboard"} />
      </>
    );
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
    "aftersales manager",
  ];
  const isWorkshopManager = hasRole(["workshop manager"]); // workshop specific role
  const isServiceManager = hasRole(["service manager"]); // service manager role
  const isAfterSalesManager = hasRole([
    "after sales manager",
    "after sales director",
    "aftersales manager",
  ]); // after sales leadership roles
  const isRetailManager = normalizedRoles.some(
    (roleName) =>
      retailManagerRoles.includes(roleName) &&
      !specialDashboardRoles.includes(roleName) &&
      roleName !== "parts manager" &&
      roleName !== "parts"
  ); // show shared retail dashboard only for remaining roles
  const shouldShowRetailDashboard = isRetailManager || isServiceDepartment;

  if (isWorkshopManager) {
    return (
      <>
        <WorkshopManagerDashboard />
      </>
    );
  }

  if (isServiceManager) {
    return (
      <>
        <ServiceManagerDashboard />
      </>
    );
  }

  if (isAfterSalesManager) {
    return (
      <>
        <AfterSalesManagerDashboard />
      </>
    );
  }

  if (shouldShowRetailDashboard) { // render shared retail/service experience
    return (
      <>
        <RetailManagersDashboard user={user} /> {/* show retail dashboard */}
      </>
    );
  }

  const handleSearch = () => {
    const results = jobs.filter( // filter jobs by search term
      (job) =>
        job.jobNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.reg?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setSearchResults(results); // update results state
  };

  return (
    <>
      <PageShell sectionKey="dashboard-fallback-shell">
        <ContentWidth sectionKey="dashboard-fallback-content" parentKey="dashboard-fallback-shell" widthMode="content">
        <div> {/* outer container for dashboard */}
        <div
          className="app-section-card"
          data-dev-section="1"
          data-dev-section-key="dashboard-fallback-toolbar"
          data-dev-section-type="toolbar"
          data-dev-section-parent="dashboard-fallback-content"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "12px 20px",
          }}
        >
          <button
            onClick={() => setShowSearch(true)}
            style={{
              padding: "10px 16px",
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-xs)",
              fontSize: "0.9rem",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </div>

        <div
          data-dev-section="1"
          data-dev-section-key="dashboard-fallback-table-shell"
          data-dev-section-type="section-shell"
          data-dev-section-parent="dashboard-fallback-content"
          data-dev-shell="1"
          style={{
            backgroundColor: "var(--danger-surface)",
            padding: "var(--section-card-padding)",
            borderRadius: "var(--radius-xs)",
            minHeight: "70vh",
          }}
        >
          <p>Welcome {user?.username || "Guest"}! Here’s your current jobs overview.</p>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--danger)" }}>
                <th style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>Job Number</th>
                <th style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>Customer</th>
                <th style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>Vehicle</th>
                <th style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>Status</th>
                <th style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>Technician</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>{job.jobNumber}</td>
                  <td style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>{job.customer}</td>
                  <td style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>
                    {job.make} {job.model} ({job.reg})
                  </td>
                  <td style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>{job.status}</td>
                  <td style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>{job.technician}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </ContentWidth>
      </PageShell>

      {showSearch && (
        <DevLayoutSection
          sectionKey="dashboard-fallback-search-modal"
          sectionType="floating-action"
          style={{
            ...popupOverlayStyles,
            zIndex: 1300,
          }}
        >
          <SectionShell
            sectionKey="dashboard-fallback-search-modal-card"
            parentKey="dashboard-fallback-search-modal"
            style={{
              ...popupCardStyles,
              padding: "30px",
              width: "min(420px, 90%)",
              backgroundColor: "var(--search-surface)",
              border: "1px solid var(--search-surface-muted)",
              color: "var(--search-text)",
            }}
          >
            <h2 style={{ marginBottom: "16px", color: "var(--primary)" }}>Search Jobs</h2>
            <SearchBar
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm("")}
              placeholder="Search by job number, reg, or customer"
              style={{
                width: "100%",
                marginBottom: "12px",
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "var(--primary)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-xs)",
                marginBottom: "12px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Search
            </button>
            <button
              onClick={() => setShowSearch(false)}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "var(--info-surface)",
                color: "var(--text-secondary)",
                border: "none",
                borderRadius: "var(--radius-xs)",
                cursor: "pointer",
              }}
            >
              Close
            </button>

            <div style={{ marginTop: "20px", maxHeight: "200px", overflowY: "auto" }}>
              {searchResults.length === 0 ? (
                <p style={{ color: "var(--grey-accent)" }}>No results found.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {searchResults.map((job) => (
                    <li
                      key={job.id}
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid var(--surface-light)",
                      }}
                    >
                      <strong>{job.jobNumber}</strong> - {job.customer} ({job.reg})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SectionShell>
        </DevLayoutSection>
      )}
    </>
  );
}
