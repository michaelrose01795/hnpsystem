// file location: src/pages/newsfeed.js
import React from "react";
import { useUser } from "../context/UserContext";
import Link from "next/link";
import Layout from "../components/Layout"; // ⬅️ wrap page in Layout

const globalNews = [
  { id: 1, title: "Welcome to H&P DMS!", content: "Check out the latest updates across all departments.", date: "2025-09-22" },
  { id: 2, title: "New Safety Guidelines", content: "Please review the updated workshop safety procedures.", date: "2025-09-21" },
];

const departmentActivity = {
  Service: [
    { id: 1, title: "3 New Jobs Assigned", link: "/jobs" },
    { id: 2, title: "Parts Requests Pending", link: "/requests" },
  ],
  Techs: [
    { id: 1, title: "Your Clocking Status", link: "/workshop/Clocking" },
    { id: 2, title: "Job Cards Update", link: "/jobs" },
  ],
  Parts: [
    { id: 1, title: "Parts Inventory Low", link: "/parts" },
    { id: 2, title: "New Requests to Approve", link: "/requests" },
  ],
  Manager: [
    { id: 1, title: "Controller Clocking Pending", link: "/workshop/ControllerClocking" },
    { id: 2, title: "Approvals Needed", link: "/approvals" },
  ],
};

export default function NewsFeed() {
  const { user } = useUser();
  const role = user?.roles?.[0] || "Guest";
  const activity = departmentActivity[role] || [];

  return (
    <Layout>
      <div style={{ padding: "24px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "16px", color: "#FF4040" }}>
          News Feed
        </h1>

        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "12px" }}>Company News</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {globalNews.map((news) => (
              <div key={news.id} style={{ padding: "12px", backgroundColor: "#FFF0F0", borderRadius: "6px" }}>
                <h3 style={{ margin: 0, fontWeight: "600", color: "#FF4040" }}>{news.title}</h3>
                <p style={{ margin: "4px 0" }}>{news.content}</p>
                <small style={{ color: "#AA0000" }}>{news.date}</small>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "12px" }}>Your Department Activity</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {activity.length > 0 ? (
              activity.map((item) => (
                <Link key={item.id} href={item.link} legacyBehavior>
                  <a
                    style={{
                      padding: "12px",
                      backgroundColor: "#FFF8F8",
                      borderRadius: "6px",
                      color: "#FF4040",
                      textDecoration: "none",
                      fontWeight: 500,
                    }}
                  >
                    {item.title}
                  </a>
                </Link>
              ))
            ) : (
              <p>No department activity to display.</p>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
