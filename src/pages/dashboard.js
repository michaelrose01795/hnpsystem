// file location: src/pages/dashboard.js
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "../context/UserContext";
import { useJobs } from "../context/JobsContext";
import Layout from "../components/Layout";
import WorkshopManagerDashboard from "../components/dashboards/WorkshopManagerDashboard";

export default function Dashboard() {
  const { user } = useUser();
  const { jobs, setJobs } = useJobs();
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  // Redirect roles to their specific dashboards
  useEffect(() => {
    if (!user) return;

    const role = user.roles?.[0]?.toUpperCase();

    switch (role) {
      case "SERVICE":
        router.replace("/dashboard/service");
        break;
      case "TECHS":
      case "WORKSHOP":
        router.replace("/dashboard/techs");
        break;
      case "WORKSHOP MANAGER":
        router.replace("/dashboard/workshop-manager");
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
  }, [user, router]);

  // Fetch all jobs on load
  useEffect(() => {
    const fetchJobs = async () => {
      if (user) {
        const { getAllJobs } = await import("../lib/database/jobs");
        const allJobs = await getAllJobs();
        setJobs(allJobs);
      }
    };
    fetchJobs();
  }, [user, setJobs]);

  if (!user) return null;

  const role = user?.roles?.[0] || "Guest";

  // Render Workshop Manager dashboard directly
  if (role === "Workshop Manager") {
    return (
      <Layout>
        <WorkshopManagerDashboard />
      </Layout>
    );
  }

  // 🔹 Handle search
  const handleSearch = () => {
    const results = jobs.filter(
      (job) =>
        job.jobNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.reg?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setSearchResults(results);
  };

  return (
    <Layout>
      <div style={{ padding: "0", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Top Bar */}
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

        {/* Dashboard Content */}
        <div
          style={{
            backgroundColor: "#FFF8F8",
            padding: "20px",
            borderRadius: "8px",
            minHeight: "70vh",
          }}
        >
          <h2 style={{ marginBottom: "15px", color: "#FF4040" }}>Dashboard Overview</h2>
          <p>Welcome {user?.username || "Guest"}! Here’s your current jobs overview.</p>

          {/* Jobs Table */}
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

      {/* Search Modal */}
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
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <h2 style={{ marginBottom: "15px", color: "#FF4040" }}>Search Jobs</h2>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by job number, reg, or customer..."
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #ddd",
                marginBottom: "20px",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setShowSearch(false)}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "#ccc",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                onClick={handleSearch}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "#FF4040",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Search
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <h3>Results:</h3>
                <ul>
                  {searchResults.map((job) => (
                    <li key={job.id}>
                      {job.jobNumber} - {job.customer} - {job.make} {job.model} ({job.reg})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}