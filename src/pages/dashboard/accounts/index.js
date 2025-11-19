// ⚠️ Dashboard shells should stay lightweight until UX cards are in place
import Layout from "@/components/Layout";

export default function AccountsDashboard() {
  return (
    <Layout>
      <div style={{ padding: 24 }}>
        <h1 style={{ color: "#d10000" }}>Accounts Dashboard</h1>
        <p>
          Financial KPIs, invoices awaiting approval, and department budgets will live here once reporting is wired up.
        </p>
      </div>
    </Layout>
  );
}
