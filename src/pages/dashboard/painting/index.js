// ⚠️ Dashboard shells should stay lightweight until UX cards are in place
import Layout from "@/components/Layout";

export default function PaintingDashboard() {
  return (
    <Layout>
      <div style={{ padding: 24 }}>
        <h1 style={{ color: "#d10000" }}>Painting Dashboard</h1>
        <p>
          Painting team priorities, quality checks, and turnaround insights will be shown once integrations land.
        </p>
      </div>
    </Layout>
  );
}
