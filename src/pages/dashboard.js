// file location: src/pages/dashboard.js
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "../context/UserContext";
import Layout from "../components/Layout";
import WorkshopManagerDashboard from "../components/dashboards/WorkshopManagerDashboard";

export default function Dashboard() {
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) return; // no user yet, wait

    const role = user.roles?.[0]?.toUpperCase();

    switch (role) {
      case "SERVICE":
        router.replace("/dashboard/service");
        break;
      case "TECHS":
      case "WORKSHOP":
        router.replace("/dashboard/techs");
        break;
      case "WORKSHOP MANAGER": // add Workshop Manager redirect
        router.replace("/dashboard/workshop-manager");
        break;
      case "PARTS":
        router.replace("/dashboard/parts");
        break;
      case "MANAGER":
        router.replace("/dashboard/manager");
        break;
      default:
        router.replace("/newsfeed"); // fallback
    }
  }, [user, router]);

  // Role-based rendering (for when a page directly renders this dashboard)
  if (!user) return null;

  const role = user?.roles?.[0] || "Guest";

  switch (role) {
    case "Workshop Manager":
      return (
        <Layout>
          <WorkshopManagerDashboard />
        </Layout>
      );
    // Add other roles later here...
    default:
      return (
        <Layout>
          <div style={{ padding: "24px" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#FF4040" }}>
              Dashboard
            </h1>
            <p>No dashboard available for your role yet.</p>
          </div>
        </Layout>
      );
  }
}
