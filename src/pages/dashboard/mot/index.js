// ⚠️ Dashboard shells should stay lightweight until UX cards are in place
import Layout from "@/components/Layout";

export default function MotDashboard() {
  return (
    <Layout>
      <div style={{ padding: 24 }}>
        <h1 style={{ color: "#d10000" }}>MOT Dashboard</h1>
        <p>
          Focused workspace for MOT testers—queue status, upcoming test slots, and compliance reminders will appear here.
        </p>
      </div>
    </Layout>
  );
}
