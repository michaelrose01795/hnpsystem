// Mock data added for the parts dashboards until the API feeds are connected.
import React from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import PartsDashboardGrid from "@/components/Parts/PartsDashboardGrid";

const SUMMARY_CARDS = [
  { label: "Service Level", value: "92%", helper: "+4% vs last week" },
  { label: "Waiting Jobs", value: "18", helper: "12 need parts picking" },
  { label: "Value Allocated", value: "£18,250", helper: "For 27 live jobs" },
  { label: "Today’s Orders", value: "37", helper: "14 already fulfilled" },
];

const ACTIVE_WORKLOAD = [
  {
    jobNumber: "JC1431",
    reg: "RJ23 VHC",
    advisor: "Amelia J.",
    neededBy: "09:30",
    status: "Awaiting Stock",
    statusColor: "rgba(209,0,0,0.12)",
    statusTextColor: "#a00000",
    value: "£420",
  },
  {
    jobNumber: "JC1432",
    reg: "KP70 VBU",
    advisor: "Liam P.",
    neededBy: "10:15",
    status: "Picking",
    statusColor: "rgba(16,185,129,0.16)",
    statusTextColor: "#047857",
    value: "£185",
  },
  {
    jobNumber: "JC1433",
    reg: "DF19 LKG",
    advisor: "Ella W.",
    neededBy: "11:00",
    status: "Ready to Collect",
    statusColor: "rgba(59,130,246,0.16)",
    statusTextColor: "#1d4ed8",
    value: "£612",
  },
  {
    jobNumber: "JC1434",
    reg: "AP21 BMO",
    advisor: "Noah H.",
    neededBy: "11:45",
    status: "Awaiting Authorisation",
    statusColor: "rgba(245,158,11,0.18)",
    statusTextColor: "#b45309",
    value: "£980",
  },
  {
    jobNumber: "JC1435",
    reg: "KY72 NLD",
    advisor: "George F.",
    neededBy: "13:15",
    status: "Picking",
    statusColor: "rgba(16,185,129,0.16)",
    statusTextColor: "#047857",
    value: "£256",
  },
];

const FOCUS_ITEMS = [
  {
    title: "Morning push",
    detail: "Clear five MOT pre-picks before 10:00",
    owner: "Lead: Liam",
  },
  {
    title: "VHC pack",
    detail: "Build parts pack for JC1430 video approval",
    owner: "Owner: Charlie",
  },
  {
    title: "Warranty order",
    detail: "Verify claim notes for turbo replacement",
    owner: "Owner: Ella",
  },
];

const INVENTORY_ALERTS = [
  { part: "Oil Filter • A321", issue: "2 left in stock", action: "Reorder 20 (auto)", priority: "high" },
  { part: "Brake Pad Kit • CP1120", issue: "6 allocated today", action: "Check ETA for Bosch shipment" },
  { part: "Fuel Cap • FC772", issue: "Backorder flagged", action: "Contact TPS for substitute" },
];

const DELIVERIES = [
  { supplier: "Bosch", eta: "09:45", items: 14, reference: "PO-5421" },
  { supplier: "TPS", eta: "11:15", items: 9, reference: "PO-5423" },
  { supplier: "Euro Car Parts", eta: "13:40", items: 22, reference: "PO-5424" },
];

const TEAM_AVAILABILITY = [
  { name: "Liam Patel", role: "Senior Parts Advisor", status: "Picking orders", window: "07:30 - 16:00" },
  { name: "Charlie Moss", role: "Counter & Workshop", status: "Counter cover", window: "08:00 - 16:30" },
  { name: "Ella Wright", role: "Parts Apprentice", status: "Goods-in", window: "08:30 - 17:00" },
  { name: "George Finn", role: "Delivery Driver", status: "External drop-offs", window: "09:00 - 17:30" },
];

export default function PartsDashboard() {
  const { user } = useUser();
  const userRoles = (user?.roles || []).map((role) => role.toLowerCase());
  const hasAccess = userRoles.includes("parts") || userRoles.includes("parts manager");

  return (
    <Layout>
      {hasAccess ? (
        <PartsDashboardGrid
          title="Parts Operations Dashboard"
          subtitle="Live look at the pick queue, inbound deliveries and daily focus so the parts counter stays ahead of workshop demand."
          summaryCards={SUMMARY_CARDS}
          workload={ACTIVE_WORKLOAD}
          focusItems={FOCUS_ITEMS}
          inventoryAlerts={INVENTORY_ALERTS}
          deliveries={DELIVERIES}
          teamAvailability={TEAM_AVAILABILITY}
        />
      ) : (
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>
          You do not have access to the Parts dashboard.
        </div>
      )}
    </Layout>
  );
}
