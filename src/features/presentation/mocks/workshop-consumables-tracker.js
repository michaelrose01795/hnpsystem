import WorkshopConsumablesTrackerUi from "@/components/page-ui/workshop/workshop-consumables-tracker-ui";
import { MockPage } from "./_helpers";

const consumables = [
  {
    id: "oil-5w30",
    name: "5W30 Engine Oil",
    lastOrderDate: "2026-04-12",
    nextEstimatedOrderDate: "2026-05-08",
    estimatedQuantity: 40,
    supplier: "HNP Trade Supplies",
    unitCost: 5.8,
    lastOrderTotalValue: 232,
    orderHistory: [],
  },
  {
    id: "nitrile-gloves",
    name: "Nitrile Gloves",
    lastOrderDate: "2026-04-20",
    nextEstimatedOrderDate: "2026-05-03",
    estimatedQuantity: 12,
    supplier: "Workshop Direct",
    unitCost: 8.5,
    lastOrderTotalValue: 102,
    orderHistory: [],
  },
  {
    id: "abrasive-discs",
    name: "Abrasive Discs",
    lastOrderDate: "2026-04-03",
    nextEstimatedOrderDate: "2026-05-18",
    estimatedQuantity: 24,
    supplier: "Paint & Prep Co",
    unitCost: 2.75,
    lastOrderTotalValue: 66,
    orderHistory: [],
  },
];

const monthlyLogs = [
  { id: "log-1", date: "2026-05-01", itemName: "5W30 Engine Oil", quantity: 40, supplier: "HNP Trade Supplies", totalValue: 232 },
  { id: "log-2", date: "2026-05-03", itemName: "Nitrile Gloves", quantity: 12, supplier: "Workshop Direct", totalValue: 102 },
  { id: "log-3", date: "2026-05-04", itemName: "Abrasive Discs", quantity: 24, supplier: "Paint & Prep Co", totalValue: 66 },
];

const techRequests = [
  { id: "req-1", itemName: "Brake Cleaner", quantity: 6, requestedByName: "Demo Tech", requestedAt: "2026-05-04", status: "pending" },
  { id: "req-2", itemName: "Screenwash Concentrate", quantity: 8, requestedByName: "A Patel", requestedAt: "2026-05-03", status: "ordered" },
];

const statusBadgeStyles = {
  pending: { background: "var(--warning-surface)", color: "var(--warning-dark)" },
  ordered: { background: "var(--success-surface)", color: "var(--success-dark)" },
  rejected: { background: "var(--danger-surface)", color: "var(--danger)" },
  urgent: { background: "var(--danger-surface)", color: "var(--danger)" },
};

export default function WorkshopConsumablesTrackerMock() {
  return (
    <MockPage
      Ui={WorkshopConsumablesTrackerUi}
      overrides={{
        view: "section2",
        isWorkshopManager: true,
        budgetInput: "1250",
        canAdvanceToNextMonth: false,
        consumables,
        filteredConsumables: consumables,
        financialLoading: false,
        formatCurrency: (value) =>
          `\u00a3${Number(value || 0).toLocaleString("en-GB", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        formatDate: (value) =>
          value
            ? new Date(value).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "-",
        getConsumableStatus: (item) => {
          const next = Date.parse(item.nextEstimatedOrderDate);
          const overdue = Number.isFinite(next) && next < Date.parse("2026-05-05");
          return overdue
            ? { label: "Overdue", tone: "danger" }
            : { label: "Due Soon", tone: "warning" };
        },
        logsLoading: false,
        logsSummary: { spend: 400, quantity: 76, orders: 3, suppliers: 3 },
        monthLabel: "May 2026",
        monthlyLogs,
        potentialDuplicates: [],
        previewLogs: [],
        requestsLoading: false,
        searchQuery: "",
        showDuplicateModal: false,
        showEditForm: false,
        showStockCheck: false,
        statusBadgeStyles,
        techRequests,
        toneToStyles: (tone) => ({
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          borderRadius: "var(--radius-pill)",
          fontWeight: 700,
          fontSize: "var(--text-caption)",
          background: tone === "danger" ? "var(--danger-surface)" : "var(--warning-surface)",
          color: tone === "danger" ? "var(--danger)" : "var(--warning-dark)",
        }),
        totals: {
          monthSpend: 400,
          projectedSpend: 1270,
          monthlyBudget: 1250,
          budgetRemaining: 850,
        },
      }}
    />
  );
}
