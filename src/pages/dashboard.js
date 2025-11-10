// file location: src/pages/dashboard.js
import React, { useEffect, useState } from "react"; // import React and hooks for state handling
import { useRouter } from "next/router"; // import router for navigation
import { useUser } from "../context/UserContext"; // import user context for authentication data
import { useJobs } from "../context/JobsContext"; // import jobs context to share job data
import Layout from "../components/Layout"; // import shared layout wrapper
import WorkshopManagerDashboard from "../components/dashboards/WorkshopManagerDashboard"; // import workshop manager dashboard component
import RetailManagersDashboard from "../components/dashboards/RetailManagersDashboard"; // import retail managers dashboard component
import { roleCategories } from "../config/users"; // import role category definitions

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

  const quickActions = [ // define quick action buttons available on the dashboard
    { label: "Create Job Card", href: "/job-cards/create" }, // link to create job card workflow
    { label: "Appointments", href: "/job-cards/appointments" }, // link to appointments planner
    { label: "Check In", href: "/workshop/check-in" }, // link to workshop check in page
  ];

  useEffect(() => {
    if (!user) return; // stop if user data not ready

    const normalizedRoles = user.roles?.map((role) => role.toLowerCase()) || []; // normalize user roles for comparisons
    const shouldStayOnRetailDashboard = normalizedRoles.some((roleName) => // determine if user should stay on retail dashboard
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
      case "PARTS":
        router.replace("/dashboard/parts");
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
        const { getAllJobs } = await import("../lib/database/jobs"); // lazy load jobs helper
        const allJobs = await getAllJobs(); // fetch all jobs from database
        setJobs(allJobs); // store fetched jobs in context
      }
    };
    fetchJobs(); // execute fetch on mount
  }, [user, setJobs]); // re-run when user or setter changes

  if (!user) return null; // do not render until user data exists

  const role = user?.roles?.[0] || "Guest"; // capture first role or default to guest
  const normalizedRoles = user?.roles?.map((r) => r.toLowerCase()) || []; // normalize roles for checks
  const isRetailManager = normalizedRoles.some((roleName) => retailManagerRoles.includes(roleName)); // check retail manager status
  const isWorkshopManager = normalizedRoles.includes("workshop manager"); // check workshop manager status

  if (isRetailManager) { // render retail manager experience
    return (
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}> {/* stack dashboard sections vertically */}
          <RetailManagersDashboard user={user} /> {/* show retail dashboard */}
          {isWorkshopManager && ( // include workshop dashboard for dual-role users
            <section
              style={{
                background: "#ffffff",
                borderRadius: "18px",
                padding: "16px",
                border: "1px solid #ffe0e0",
                boxShadow: "0 24px 45px rgba(209,0,0,0.08)",
              }}
            >
              <WorkshopManagerDashboard /> {/* embed workshop dashboard module */}
            </section>
          )}
        </div>
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
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            backgroundColor: "#ffffff",
            padding: "14px 20px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(209,0,0,0.1)",
            border: "1px solid #ffe0e0",
          }}
        >
          {quickActions.map((action) => (
            <button
              key={action.href}
              onClick={() => router.push(action.href)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 18px",
                borderRadius: "999px",
                border: "1px solid #ffb3b3",
                backgroundColor: "#ffffff",
                color: "#b10000",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                boxShadow: "0 8px 16px rgba(209,0,0,0.08)",
                transition: "background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = "#b10000";
                event.currentTarget.style.color = "#ffffff";
                event.currentTarget.style.boxShadow = "0 16px 32px rgba(177,0,0,0.18)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = "#ffffff";
                event.currentTarget.style.color = "#b10000";
                event.currentTarget.style.boxShadow = "0 8px 16px rgba(209,0,0,0.08)";
              }}
            >
              {action.label}
            </button>
          ))}
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
