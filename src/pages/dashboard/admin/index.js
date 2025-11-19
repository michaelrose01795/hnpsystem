// ⚠️ Dashboard shells should stay lightweight until UX cards are in place
import Layout from "@/components/Layout";

export default function AdminDashboard() {
  return (
    <Layout>
      <div style={{ padding: 24 }}>
        <h1 style={{ color: "#d10000" }}>Admin Dashboard</h1>
        <p>
          High-level admin metrics, approvals, and escalation notes will surface here after the data fabric is connected.
        </p>
      </div>
    </Layout>
  );
}
