// file location: src/pages/dashboard.js
import React, { useEffect, useState } from "react"; // React + hooks
import { useRouter } from "next/router"; // For redirects
import { useUser } from "../context/UserContext"; // User context
import Layout from "../components/Layout"; // Shared layout
import WorkshopManagerDashboard from "../components/dashboards/WorkshopManagerDashboard"; // Example role dashboard

export default function Dashboard() {
  const { user } = useUser(); // Get logged-in user
  const router = useRouter(); // Router for navigation
  const [showSearch, setShowSearch] = useState(false); // State for search pop-up

  // Auto-redirect certain roles to their dashboards
  useEffect(() => {
    if (!user) return; // Wait for user

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
        break; // stay on main dashboard
    }
  }, [user, router]);

  if (!user) return null; // No render until we have user

  const role = user?.roles?.[0] || "Guest";

  // Special case: if directly rendering Workshop Manager dashboard
  if (role === "Workshop Manager") {
    return (
      <Layout>
        <WorkshopManagerDashboard />
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        style={{
          padding: "0",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* ✅ Top Bar */}
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
          {/* 🔍 Search Button */}
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

        {/* ✅ Dashboard Content */}
        <div
          style={{
            backgroundColor: "#FFF8F8",
            padding: "20px",
            borderRadius: "8px",
            minHeight: "70vh",
          }}
        >
          <h2 style={{ marginBottom: "15px", color: "#FF4040" }}>
            Dashboard Overview
          </h2>
          <p>
            Welcome {user?.username || "Guest"}! Here you’ll see your dashboard
            widgets, stats, and features.
          </p>

          {/* Example placeholder feature buttons */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "20px",
              marginTop: "20px",
            }}
          >
            {[
              "Active Jobs",
              "Today’s Clockings",
              "Job Cards",
              "Parts Requests",
              "VHC Checks",
              "Sales Tracking",
              "Inventory",
              "Messaging",
              "Reports",
            ].map((feature) => (
              <div
                key={feature}
                style={{
                  backgroundColor: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                  textAlign: "center",
                  cursor: "pointer",
                }}
              >
                <h3 style={{ marginBottom: "10px", color: "#333" }}>{feature}</h3>
                <p style={{ color: "#777", fontSize: "0.9rem" }}>
                  {feature} feature placeholder
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🔍 Search Modal */}
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
            <h2 style={{ marginBottom: "15px", color: "#FF4040" }}>
              Search System
            </h2>
            <input
              type="text"
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
          </div>
        </div>
      )}
    </Layout>
  );
}