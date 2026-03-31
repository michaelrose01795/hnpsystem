// file location: src/customers/pages/DashboardPage.js
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import CustomerLayout from "@/customers/components/CustomerLayout";
import CustomerHero from "@/customers/components/CustomerHero";
import VehicleGarageCard from "@/customers/components/VehicleGarageCard";
import VHCSummaryList from "@/customers/components/VHCSummaryList";
import PartsAccessCard from "@/customers/components/PartsAccessCard";
import MessagingHub from "@/customers/components/MessagingHub";
import AppointmentTimeline from "@/customers/components/AppointmentTimeline";
import CustomerBookingCalendar from "@/customers/components/CustomerBookingCalendar";
import CustomerDetailsCard from "@/customers/components/CustomerDetailsCard";
import PaymentPlansCard from "@/customers/components/PaymentPlansCard";
import OutstandingInvoicesCard from "@/customers/components/OutstandingInvoicesCard";
import PaymentMethodsCard from "@/customers/components/PaymentMethodsCard";
import { useCustomerPortalData } from "@/customers/hooks/useCustomerPortalData";

const WIDGET_LIBRARY = [
  {
    type: "hero",
    name: "Hero summary",
    description: "Key visit timing and workshop activity at the top of the dashboard.",
    category: "Overview",
    allowMultiple: false,
    defaultConfig: {},
  },
  {
    type: "booking-calendar",
    name: "Booking calendar",
    description: "Booking links and calendar access for workshop visits.",
    category: "Tracking",
    allowMultiple: false,
    defaultConfig: {},
  },
  {
    type: "vhc-summary",
    name: "VHC summary",
    description: "Vehicle health check results and latest customer-visible reports.",
    category: "Tracking",
    allowMultiple: false,
    defaultConfig: {},
  },
  {
    type: "appointment-timeline",
    name: "Appointment timeline",
    description: "Recent status changes and service journey milestones.",
    category: "Tracking",
    allowMultiple: false,
    defaultConfig: {},
  },
  {
    type: "customer-details",
    name: "Customer details",
    description: "Profile and contact details with inline editing.",
    category: "Profile",
    allowMultiple: false,
    defaultConfig: {},
  },
  {
    type: "vehicle-garage",
    name: "Vehicle garage",
    description: "Registered vehicles, service history, and quick links.",
    category: "Tracking",
    allowMultiple: false,
    defaultConfig: {},
  },
  {
    type: "parts-access",
    name: "Parts access",
    description: "Featured parts and accessories linked to the customer account.",
    category: "Tracking",
    allowMultiple: false,
    defaultConfig: {},
  },
  {
    type: "messaging-hub",
    name: "Messaging hub",
    description: "Key workshop contacts for service, sales, and parts.",
    category: "Tracking",
    allowMultiple: false,
    defaultConfig: {},
  },
  {
    type: "finance-overview",
    name: "Finance overview",
    description: "Combined view of invoices, plans, and saved payment methods.",
    category: "Finance",
    allowMultiple: false,
    defaultConfig: {},
  },
  {
    type: "tracking-overview",
    name: "Tracking overview",
    description: "At-a-glance service progress, VHC activity, and next visits.",
    category: "Tracking",
    allowMultiple: false,
    defaultConfig: {},
  },
  {
    type: "payment-plans",
    name: "Payment plans",
    description: "Detailed list of active payment plans and balances.",
    category: "Finance",
    allowMultiple: false,
    defaultConfig: {},
  },
  {
    type: "payment-methods",
    name: "Payment methods",
    description: "Saved customer cards and card management form.",
    category: "Finance",
    allowMultiple: false,
    defaultConfig: {},
  },
  {
    type: "outstanding-invoices",
    name: "Outstanding invoices",
    description: "Unpaid invoices with payment links.",
    category: "Finance",
    allowMultiple: false,
    defaultConfig: {},
  },
  {
    type: "custom-summary",
    name: "Custom summary",
    description: "Configurable summary card for finance, tracking, VHC, vehicles, or contacts.",
    category: "Custom",
    allowMultiple: true,
    defaultConfig: {
      title: "Custom summary",
      source: "tracking",
      note: "",
    },
  },
  {
    type: "user-defined",
    name: "User-defined widget",
    description: "Free-form card with your own title, metric, and supporting note.",
    category: "Custom",
    allowMultiple: true,
    defaultConfig: {
      title: "New widget",
      metricLabel: "Metric",
      metricValue: "0",
      body: "",
    },
  },
];

const CUSTOM_SUMMARY_SOURCE_OPTIONS = [
  { value: "tracking", label: "Tracking" },
  { value: "finance", label: "Finance" },
  { value: "vehicles", label: "Vehicles" },
  { value: "vhc", label: "VHC" },
  { value: "contacts", label: "Contacts" },
];

const WIDGET_LIBRARY_BY_TYPE = WIDGET_LIBRARY.reduce((acc, entry) => {
  acc[entry.type] = entry;
  return acc;
}, {});

const buildWidgetId = (type) => `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createWidget = (type) => {
  const definition = WIDGET_LIBRARY_BY_TYPE[type];
  if (!definition) return null;
  return {
    id: buildWidgetId(type),
    type,
    config: { ...definition.defaultConfig },
  };
};

const getWidgetTitle = (widget) => {
  if (widget.type === "custom-summary") {
    return widget.config?.title || "Custom summary";
  }
  if (widget.type === "user-defined") {
    return widget.config?.title || "User-defined widget";
  }
  return WIDGET_LIBRARY_BY_TYPE[widget.type]?.name || "Widget";
};

function DashboardShellCard({ title, eyebrow, children, actions, fullWidth = false }) {
  return (
    <section
      className={`rounded-3xl border border-[var(--surface-light)] bg-[var(--surface)] p-5 shadow-sm ${
        fullWidth ? "xl:col-span-2" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              {eyebrow}
            </p>
          ) : null}
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MetricTile({ label, value, tone = "default" }) {
  const toneClass =
    tone === "accent"
      ? "border-[color:color-mix(in_srgb,var(--primary)_28%,white)] bg-[color:color-mix(in_srgb,var(--primary)_8%,white)]"
      : "border-[var(--surface-light)] bg-[var(--surface-light)]";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function WidgetEditModal({
  widget,
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState(widget?.config || {});

  useEffect(() => {
    setDraft(widget?.config || {});
  }, [widget]);

  if (!widget) return null;

  const isCustomSummary = widget.type === "custom-summary";
  const isUserDefined = widget.type === "user-defined";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-3xl border border-[var(--surface-light)] bg-[var(--surface)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              Widget settings
            </p>
            <h3 className="text-xl font-semibold text-[var(--text-primary)]">{getWidgetTitle(widget)}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--surface-light)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)]"
          >
            Close
          </button>
        </div>

        {isCustomSummary ? (
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              Title
              <input
                type="text"
                value={draft.title || ""}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              />
            </label>

            <label className="block text-sm font-medium text-[var(--text-primary)]">
              Summary source
              <select
                value={draft.source || "tracking"}
                onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              >
                {CUSTOM_SUMMARY_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-[var(--text-primary)]">
              Note
              <textarea
                value={draft.note || ""}
                onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                rows={4}
                className="mt-1 w-full rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                placeholder="Optional context shown under the summary."
              />
            </label>
          </div>
        ) : null}

        {isUserDefined ? (
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              Title
              <input
                type="text"
                value={draft.title || ""}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                Metric label
                <input
                  type="text"
                  value={draft.metricLabel || ""}
                  onChange={(event) => setDraft((current) => ({ ...current, metricLabel: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                />
              </label>
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                Metric value
                <input
                  type="text"
                  value={draft.metricValue || ""}
                  onChange={(event) => setDraft((current) => ({ ...current, metricValue: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-[var(--text-primary)]">
              Body
              <textarea
                value={draft.body || ""}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                rows={5}
                className="mt-1 w-full rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                placeholder="Add free-form notes, reminders, or a custom summary."
              />
            </label>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--surface-light)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="rounded-full bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white"
          >
            Save widget
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerDashboardPage() {
  const {
    vehicles,
    vhcSummaries,
    jobs,
    parts,
    contacts,
    timeline,
    customer,
    isLoading,
    error,
    refreshPortalData,
    paymentMethods,
    paymentPlans,
    outstandingInvoices,
    dashboardWidgets,
    widgetsSaving,
    saveDashboardWidgets,
  } = useCustomerPortalData();

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState(null);

  const lastUpdated = useMemo(() => {
    const timestamps = [];
    (jobs || []).forEach((job) => {
      if (job.updated_at) timestamps.push(new Date(job.updated_at));
      else if (job.created_at) timestamps.push(new Date(job.created_at));
    });
    (vhcSummaries || []).forEach((summary) => {
      if (summary.createdAtRaw) timestamps.push(new Date(summary.createdAtRaw));
    });
    if (!timestamps.length) return null;
    const latest = new Date(Math.max(...timestamps.map((date) => date.getTime())));
    return dayjs(latest).format("DD MMM · HH:mm");
  }, [jobs, vhcSummaries]);

  const nextVisit = useMemo(() => {
    const dated = (vehicles || [])
      .map((vehicle) => vehicle.nextService)
      .filter(Boolean)
      .find((value) => value !== "TBC" && value !== "—");
    return dated || null;
  }, [vehicles]);

  const financeStats = useMemo(() => {
    const outstandingTotal = (outstandingInvoices || []).reduce(
      (sum, invoice) => sum + Number(invoice.total || 0),
      0
    );
    const planBalance = (paymentPlans || []).reduce((sum, plan) => sum + Number(plan.balanceDue || 0), 0);

    return {
      outstandingCount: outstandingInvoices?.length || 0,
      outstandingTotal,
      planCount: paymentPlans?.length || 0,
      planBalance,
      savedMethods: paymentMethods?.length || 0,
    };
  }, [outstandingInvoices, paymentPlans, paymentMethods]);

  const trackingStats = useMemo(() => {
    const activeJobs = (jobs || []).filter((job) => !["delivered", "closed", "completed"].includes(String(job.status || "").toLowerCase())).length;
    const pendingVhc = (vhcSummaries || []).filter((summary) => String(summary.status || "").toLowerCase() !== "complete").length;

    return {
      activeJobs,
      pendingVhc,
      vehicleCount: vehicles?.length || 0,
      nextVisit: nextVisit || "TBC",
      recentTimeline: (timeline || []).slice(0, 3),
    };
  }, [jobs, vhcSummaries, vehicles, nextVisit, timeline]);

  const widgetsByType = useMemo(
    () =>
      (dashboardWidgets || []).reduce((acc, widget) => {
        if (!acc[widget.type]) acc[widget.type] = 0;
        acc[widget.type] += 1;
        return acc;
      }, {}),
    [dashboardWidgets]
  );

  const availableWidgets = useMemo(
    () =>
      WIDGET_LIBRARY.map((entry) => ({
        ...entry,
        disabled: !entry.allowMultiple && (widgetsByType[entry.type] || 0) > 0,
      })),
    [widgetsByType]
  );

  const editingWidget = useMemo(
    () => (dashboardWidgets || []).find((widget) => widget.id === editingWidgetId) || null,
    [dashboardWidgets, editingWidgetId]
  );

  const persistWidgets = async (nextWidgets) => {
    try {
      await saveDashboardWidgets(nextWidgets);
    } catch (_error) {
      return;
    }
  };

  const handleAddWidget = async (type) => {
    const nextWidget = createWidget(type);
    if (!nextWidget) return;
    await persistWidgets([...(dashboardWidgets || []), nextWidget]);
    setIsLibraryOpen(false);
    if (nextWidget.type === "custom-summary" || nextWidget.type === "user-defined") {
      setEditingWidgetId(nextWidget.id);
    }
  };

  const handleRemoveWidget = async (widgetId) => {
    const nextWidgets = (dashboardWidgets || []).filter((widget) => widget.id !== widgetId);
    await persistWidgets(nextWidgets);
    if (editingWidgetId === widgetId) {
      setEditingWidgetId(null);
    }
  };

  const handleSaveWidgetConfig = async (config) => {
    const nextWidgets = (dashboardWidgets || []).map((widget) =>
      widget.id === editingWidgetId ? { ...widget, config: { ...config } } : widget
    );
    await persistWidgets(nextWidgets);
    setEditingWidgetId(null);
  };

  const renderCustomSummary = (widget) => {
    const source = widget.config?.source || "tracking";
    const note = widget.config?.note || "";
    const title = widget.config?.title || "Custom summary";

    if (source === "finance") {
      return (
        <DashboardShellCard title={title} eyebrow="Custom summary">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricTile label="Outstanding" value={`£${financeStats.outstandingTotal.toFixed(2)}`} tone="accent" />
            <MetricTile label="Plans" value={String(financeStats.planCount)} />
            <MetricTile label="Saved cards" value={String(financeStats.savedMethods)} />
          </div>
          {note ? <p className="mt-4 text-sm text-[var(--text-secondary)]">{note}</p> : null}
        </DashboardShellCard>
      );
    }

    if (source === "vehicles") {
      return (
        <DashboardShellCard title={title} eyebrow="Custom summary">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricTile label="Vehicles" value={String(vehicles?.length || 0)} tone="accent" />
            <MetricTile label="Next visit" value={nextVisit || "TBC"} />
            <MetricTile label="Parts shown" value={String(parts?.length || 0)} />
          </div>
          {note ? <p className="mt-4 text-sm text-[var(--text-secondary)]">{note}</p> : null}
        </DashboardShellCard>
      );
    }

    if (source === "vhc") {
      const readyCount = (vhcSummaries || []).filter((summary) => summary.mediaCount > 0).length;
      return (
        <DashboardShellCard title={title} eyebrow="Custom summary">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricTile label="Reports" value={String(vhcSummaries?.length || 0)} tone="accent" />
            <MetricTile label="With media" value={String(readyCount)} />
            <MetricTile label="Pending" value={String(trackingStats.pendingVhc)} />
          </div>
          {note ? <p className="mt-4 text-sm text-[var(--text-secondary)]">{note}</p> : null}
        </DashboardShellCard>
      );
    }

    if (source === "contacts") {
      return (
        <DashboardShellCard title={title} eyebrow="Custom summary">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricTile label="Contacts" value={String(contacts?.length || 0)} tone="accent" />
            <MetricTile label="Primary" value={contacts?.[0]?.label || "N/A"} />
            <MetricTile label="Customer" value={customer?.firstname || "Profile"} />
          </div>
          {note ? <p className="mt-4 text-sm text-[var(--text-secondary)]">{note}</p> : null}
        </DashboardShellCard>
      );
    }

    return (
      <DashboardShellCard title={title} eyebrow="Custom summary">
        <div className="grid gap-3 md:grid-cols-3">
          <MetricTile label="Active jobs" value={String(trackingStats.activeJobs)} tone="accent" />
          <MetricTile label="Timeline items" value={String(timeline?.length || 0)} />
          <MetricTile label="Vehicles" value={String(trackingStats.vehicleCount)} />
        </div>
        {note ? <p className="mt-4 text-sm text-[var(--text-secondary)]">{note}</p> : null}
      </DashboardShellCard>
    );
  };

  const renderWidgetContent = (widget) => {
    switch (widget.type) {
      case "hero":
        return <CustomerHero nextVisit={nextVisit} lastUpdated={lastUpdated} />;
      case "booking-calendar":
        return <CustomerBookingCalendar />;
      case "vhc-summary":
        return <VHCSummaryList summaries={vhcSummaries} vehicles={vehicles} />;
      case "appointment-timeline":
        return <AppointmentTimeline events={timeline} />;
      case "customer-details":
        return <CustomerDetailsCard customer={customer} onDetailsSaved={refreshPortalData} />;
      case "vehicle-garage":
        return <VehicleGarageCard vehicles={vehicles} />;
      case "parts-access":
        return <PartsAccessCard parts={parts} />;
      case "messaging-hub":
        return <MessagingHub contacts={contacts} />;
      case "payment-plans":
        return <PaymentPlansCard paymentPlans={paymentPlans} />;
      case "payment-methods":
        return (
          <PaymentMethodsCard
            paymentMethods={paymentMethods}
            customerId={customer?.id}
            onPaymentMethodSaved={refreshPortalData}
          />
        );
      case "outstanding-invoices":
        return <OutstandingInvoicesCard invoices={outstandingInvoices} />;
      case "finance-overview":
        return (
          <DashboardShellCard title="Finance overview" eyebrow="Finance">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                label="Outstanding total"
                value={`£${financeStats.outstandingTotal.toFixed(2)}`}
                tone="accent"
              />
              <MetricTile label="Open invoices" value={String(financeStats.outstandingCount)} />
              <MetricTile label="Plan balance" value={`£${financeStats.planBalance.toFixed(2)}`} />
              <MetricTile label="Saved cards" value={String(financeStats.savedMethods)} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                  Payment plans
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {financeStats.planCount
                    ? `${financeStats.planCount} active plan${financeStats.planCount === 1 ? "" : "s"} with £${financeStats.planBalance.toFixed(2)} remaining.`
                    : "No active payment plans on this account."}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                  Next action
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {outstandingInvoices?.[0]?.paymentLink
                    ? `Latest payment link ready for invoice ${String(outstandingInvoices[0].id).slice(0, 8)}.`
                    : "No active online payment link found for the latest invoice."}
                </p>
              </div>
            </div>
          </DashboardShellCard>
        );
      case "tracking-overview":
        return (
          <DashboardShellCard title="Tracking overview" eyebrow="Tracking">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Active jobs" value={String(trackingStats.activeJobs)} tone="accent" />
              <MetricTile label="Pending VHC" value={String(trackingStats.pendingVhc)} />
              <MetricTile label="Vehicles" value={String(trackingStats.vehicleCount)} />
              <MetricTile label="Next visit" value={trackingStats.nextVisit} />
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                Recent movement
              </p>
              {trackingStats.recentTimeline.length ? (
                <div className="mt-3 space-y-3">
                  {trackingStats.recentTimeline.map((event) => (
                    <div key={event.id} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{event.label}</p>
                        <p className="text-[var(--text-secondary)]">{event.description}</p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-[var(--text-secondary)]">{event.timestamp}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">No recent service updates yet.</p>
              )}
            </div>
          </DashboardShellCard>
        );
      case "custom-summary":
        return renderCustomSummary(widget);
      case "user-defined":
        return (
          <DashboardShellCard title={widget.config?.title || "User-defined widget"} eyebrow="Custom widget">
            <div className="grid gap-4 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
              <MetricTile
                label={widget.config?.metricLabel || "Metric"}
                value={widget.config?.metricValue || "0"}
                tone="accent"
              />
              <div className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] px-4 py-4 text-sm text-[var(--text-secondary)]">
                {widget.config?.body || "Use Edit to add your own note, process summary, or customer-specific prompt."}
              </div>
            </div>
          </DashboardShellCard>
        );
      default:
        return (
          <DashboardShellCard title="Unavailable widget" eyebrow="Widget">
            <p className="text-sm text-[var(--text-secondary)]">
              This widget type is no longer supported. Remove it and add a replacement from the widget library.
            </p>
          </DashboardShellCard>
        );
    }
  };

  return (
    <CustomerLayout>
      {error ? (
        <div className="mb-4 rounded-2xl border border-[var(--danger)] bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
          {error}
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[var(--surface-light)] bg-[var(--surface)] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
            Customer settings widgets
          </p>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Configure your dashboard</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Add, remove, and customise the widgets shown in your customer portal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {widgetsSaving ? (
            <span className="rounded-full bg-[var(--surface-light)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
              Saving layout...
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setIsLibraryOpen((open) => !open)}
            className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            Add Widget
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)]">
          Loading your live workshop data…
        </div>
      ) : null}

      {!isLoading && isLibraryOpen ? (
        <section className="mb-6 rounded-3xl border border-[var(--surface-light)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                Widget library
              </p>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Available widget types</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsLibraryOpen(false)}
              className="rounded-full border border-[var(--surface-light)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)]"
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {availableWidgets.map((widget) => (
              <div
                key={widget.type}
                className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                      {widget.category}
                    </p>
                    <h4 className="text-base font-semibold text-[var(--text-primary)]">{widget.name}</h4>
                  </div>
                  {!widget.allowMultiple ? (
                    <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                      Single
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{widget.description}</p>
                <button
                  type="button"
                  disabled={widget.disabled || widgetsSaving}
                  onClick={() => handleAddWidget(widget.type)}
                  className="mt-4 rounded-full border border-[var(--surface-light)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {widget.disabled ? "Already added" : "Add widget"}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!isLoading ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {(dashboardWidgets || []).map((widget) => {
            const definition = WIDGET_LIBRARY_BY_TYPE[widget.type];
            const canEditConfig = widget.type === "custom-summary" || widget.type === "user-defined";
            const fullWidth = widget.type === "hero";

            return (
              <div key={widget.id} className={fullWidth ? "xl:col-span-2" : ""}>
                <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
                  {canEditConfig ? (
                    <button
                      type="button"
                      onClick={() => setEditingWidgetId(widget.id)}
                      className="rounded-full border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]"
                    >
                      Edit
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleRemoveWidget(widget.id)}
                    disabled={widgetsSaving}
                    className="rounded-full border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove
                  </button>
                  <span className="rounded-full bg-[var(--surface-light)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
                    {definition?.category || "Widget"}
                  </span>
                </div>
                {renderWidgetContent(widget)}
              </div>
            );
          })}
        </div>
      ) : null}

      <WidgetEditModal
        widget={editingWidget}
        onClose={() => setEditingWidgetId(null)}
        onSave={handleSaveWidgetConfig}
      />
    </CustomerLayout>
  );
}
