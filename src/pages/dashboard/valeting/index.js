// ⚠️ Dashboard shells should stay lightweight until UX cards are in place
import Layout from "@/components/Layout";

export default function ValetingDashboard() {
  return (
    <Layout>
      <div style={{ padding: 24 }}>
        <h1 style={{ color: "#d10000" }}>Valeting Dashboard</h1>
        <p>
          This space will surface wash bay priorities, vehicle handovers, and team assignments for the valeting crew.
        </p>
      </div>
    </Layout>
  );
}
