// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/dashboard.js
import React, { useEffect, useState } from "react"; // import React and hooks for state handling
import { useRouter } from "next/router"; // import router for navigation
import { useUser } from "@/context/UserContext"; // import user context for authentication data
import { useJobs } from "@/context/JobsContext"; // import jobs context to share job data
import Layout from "@/components/Layout"; // import shared layout wrapper
import WorkshopManagerDashboard from "@/components/dashboards/WorkshopManagerDashboard"; // import workshop manager dashboard component
import ServiceManagerDashboard from "@/components/dashboards/ServiceManagerDashboard"; // import service manager dashboard
import AfterSalesManagerDashboard from "@/components/dashboards/AfterSalesManagerDashboard"; // import after sales manager dashboard
import RetailManagersDashboard from "@/components/dashboards/RetailManagersDashboard"; // import retail managers dashboard component
import PartsOpsDashboard from "@/components/dashboards/PartsOpsDashboard";
import { roleCategories } from "@/config/users"; // import role category definitions

const retailManagerRoles = (roleCategories?.Retail || []) // build a list of retail manager roles
  .filter((roleName) => /manager|director/i.test(roleName)) // keep only manager or director titles
  .map((roleName) => roleName.toLowerCase()); // normalize to lowercase for comparison

export default function Dashboard() {
  const { user } = useUser(); // get current user information
  const { jobs, setJobs } = useJobs(); // access shared jobs state
  const router = useRouter(); // initialize router for redirects
  const [showSearch, setShowSearch] = useState(false); // control visibility of search modal
  const [searchTerm, setSearchTerm] = useState(""); // store search term input
  const [searchResults, setSearchResults] = useState([]); // store filtered search results

  useEffect(() => {
    if (!user) return; // stop if user data not ready

    const normalizedRoles = user.roles?.map((role) => role.toLowerCase()) || [];
    const isPartsRole = normalizedRoles.some((role) => role === "parts" || role === "parts manager");
    if (isPartsRole) return; // parts roles now use this dashboard

    const shouldStayOnRetailDashboard = normalizedRoles.some((roleName) =>
      retailManagerRoles.includes(roleName)
    );
    if (shouldStayOnRetailDashboard) return; // keep retail managers on this page

    const role = user.roles?.[0]?.toUpperCase(); // get primary role in uppercase

    switch (role) { // redirect non-retail roles to their dedicated dashboards
      case "SERVICE":
        router.replace("/dashboard/service");
        break;
      case "TECHS":
      case "WORKSHOP":
        router.replace("/dashboard/techs");
        break;
      case "MANAGER":
        router.replace("/dashboard/manager");
        break;
      default:
        break;
    }
  }, [user, router]); // re-run redirects when user or router changes

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

  if (!user) return null; // do not render until user data exists

  const normalizedRoles = user?.roles?.map((r) => r.toLowerCase()) || []; // normalize roles for checks
  const hasRole = (rolesToMatch = []) =>
    normalizedRoles.some((roleName) => rolesToMatch.includes(roleName)); // helper to match roles
  const isPartsRole = hasRole(["parts", "parts manager"]);
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

  if (isPartsRole) {
    return (
      <Layout>
        <PartsOpsDashboard />
      </Layout>
    );
  }

  if (isWorkshopManager) {
    return (
      <Layout>
        <WorkshopManagerDashboard />
      </Layout>
    );
  }

  if (isServiceManager) {
    return (
      <Layout>
        <ServiceManagerDashboard />
      </Layout>
    );
  }

  if (isAfterSalesManager) {
    return (
      <Layout>
        <AfterSalesManagerDashboard />
      </Layout>
    );
  }

  if (isRetailManager) { // render shared retail manager experience
    return (
      <Layout>
        <RetailManagersDashboard user={user} /> {/* show retail dashboard */}
      </Layout>
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
    <Layout>
      <div style={{ padding: "0", display: "flex", flexDirection: "column", gap: "20px" }}> {/* outer container for dashboard */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            backgroundColor: "white",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          }}
        >
          <button
            onClick={() => setShowSearch(true)}
            style={{
              padding: "10px 16px",
              backgroundColor: "#FF4040",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.9rem",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            🔍 Search
          </button>
        </div>

        <div
          style={{
            backgroundColor: "#FFF8F8",
            padding: "20px",
            borderRadius: "8px",
            minHeight: "70vh",
          }}
        >
          <p>Welcome {user?.username || "Guest"}! Here’s your current jobs overview.</p>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
            <thead>
              <tr style={{ backgroundColor: "#FFCCCC" }}>
                <th style={{ padding: "8px", border: "1px solid #FFAAAA" }}>Job Number</th>
                <th style={{ padding: "8px", border: "1px solid #FFAAAA" }}>Customer</th>
                <th style={{ padding: "8px", border: "1px solid #FFAAAA" }}>Vehicle</th>
                <th style={{ padding: "8px", border: "1px solid #FFAAAA" }}>Status</th>
                <th style={{ padding: "8px", border: "1px solid #FFAAAA" }}>Technician</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td style={{ padding: "8px", border: "1px solid #FFAAAA" }}>{job.jobNumber}</td>
                  <td style={{ padding: "8px", border: "1px solid #FFAAAA" }}>{job.customer}</td>
                  <td style={{ padding: "8px", border: "1px solid #FFAAAA" }}>
                    {job.make} {job.model} ({job.reg})
                  </td>
                  <td style={{ padding: "8px", border: "1px solid #FFAAAA" }}>{job.status}</td>
                  <td style={{ padding: "8px", border: "1px solid #FFAAAA" }}>{job.technician}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showSearch && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "30px",
              borderRadius: "10px",
              width: "400px",
              maxWidth: "90%",
              boxShadow: "0 20px 45px rgba(0,0,0,0.2)",
            }}
          >
            <h2 style={{ marginBottom: "16px", color: "#FF4040" }}>Search Jobs</h2>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by job number, reg, or customer"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid #ddd",
                marginBottom: "12px",
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#FF4040",
                color: "white",
                border: "none",
                borderRadius: "6px",
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
                backgroundColor: "#f3f4f6",
                color: "#333",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Close
            </button>

            <div style={{ marginTop: "20px", maxHeight: "200px", overflowY: "auto" }}>
              {searchResults.length === 0 ? (
                <p style={{ color: "#666" }}>No results found.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {searchResults.map((job) => (
                    <li
                      key={job.id}
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      <strong>{job.jobNumber}</strong> - {job.customer} ({job.reg})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
