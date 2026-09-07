// file location: src/pages/customers/[customerSlug].js
//
// The staff customer record — one screen that answers everything about a
// customer: who they are, their vehicles, what is booked, what has happened,
// what they owe, what they and the team have done, and the conversation.
//
// This file is the container: it loads the record, derives the view model
// (src/lib/customers/customerHubModel.js), resolves what the signed-in role may
// do (src/lib/customers/customerAccess.js), and hands both to the presentation
// shell. The Messages tab below is deliberately unchanged.
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import {
  findDuplicateCustomers,
  getCustomerById,
  getCustomerBySlug,
  getCustomerRecordBundle,
  getCustomerVehicles,
  logCustomerActivity,
  updateCustomer,
} from "@/lib/database/customers";
import { normalizeContactPreference } from "@/lib/customers/contactPreference";
import { createCustomerDisplaySlug, normalizeCustomerSlug } from "@/lib/customers/slug";
import { isValidUuid } from "@/lib/utils/ids";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { useUser } from "@/context/UserContext";
import {
  connectCustomerToThread,
  createThread,
  fetchMessageDirectory,
  fetchMessageThreads,
  fetchThreadMessages,
  sendThreadMessage,
} from "@/lib/api/messages";
import CustomerDetailWorkspaceUi from "@/components/page-ui/customers/customers-customer-slug-ui"; // Extracted presentation layer.
import CustomerHeaderCard from "@/features/customers/hub/CustomerHeaderCard";
import CustomerAlertsPanel from "@/features/customers/hub/CustomerAlertsPanel";
import CustomerSearchBar from "@/features/customers/hub/CustomerSearchBar";
import CustomerOverviewTab from "@/features/customers/hub/CustomerOverviewTab";
import CustomerHistoryTab from "@/features/customers/hub/CustomerHistoryTab";
import CustomerPaymentsTab from "@/features/customers/hub/CustomerPaymentsTab";
import CustomerActivityTab from "@/features/customers/hub/CustomerActivityTab";
import { getCustomerRecordAccess, READ_ONLY_CUSTOMER_ACCESS } from "@/lib/customers/customerAccess";
import {
  buildActivityTimeline,
  buildAppointments,
  buildCustomerAlerts,
  buildCustomerFiles,
  buildCustomerSummary,
  buildHistoryTimeline,
  displayCustomerName,
  mergeCustomerInvoices,
} from "@/lib/customers/customerHubModel";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { logFailure } from "@/lib/utils/logFailure";

const TAB_IDS = ["overview", "history", "payments", "activity", "messages"];

// Legacy tab ids kept working so existing links and bookmarks still land in the
// right place after the rename.
const LEGACY_TAB_ALIASES = { insights: "overview", payment: "payments", notes: "activity" };

/* ==========================================================================
   Messages tab — unchanged.
   ========================================================================== */

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (_err) {
    return "—";
  }
};

const isCustomerProfileMember = (member) => {
  const role = String(member?.profile?.role || member?.role || "").toLowerCase();
  return role === "customer";
};

const isStaffDirectoryEntry = (entry) => {
  const role = String(entry?.role || entry?.profile?.role || "").toLowerCase();
  return role !== "customer";
};

const CustomerMessagesTab = ({ customerName, customerEmail, dbUserId }) => {
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const composerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const title = `Customer · ${customerName || "Customer"}`;

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "42px";
    const nextHeight = Math.min(Math.max(composer.scrollHeight, 42), 132);
    composer.style.height = `${nextHeight}px`;
    composer.style.overflowY = composer.scrollHeight > 132 ? "auto" : "hidden";
  }, [draft]);

  useEffect(() => {
    if (!dbUserId) return;
    let cancelled = false;
    const loadThread = async () => {
      setLoading(true);
      setError("");
      try {
        const threadsPayload = await fetchMessageThreads({ userId: dbUserId });
        const threads = threadsPayload?.data || [];
        let match =
        threads.find((item) => item.title === title && (item.members || []).some(isCustomerProfileMember)) ||
        threads.find((item) => item.title === title);
        const hasCustomerMember = (match?.members || []).some(isCustomerProfileMember);

        if (!match || !hasCustomerMember) {
          const directoryPayload = await fetchMessageDirectory({ limit: 500 });
          const memberIds = (directoryPayload?.data || []).
          filter(isStaffDirectoryEntry).
          map((entry) => entry.id).
          filter((id) => Number(id) !== Number(dbUserId));

          if (customerEmail || customerName) {
            const connected = await connectCustomerToThread({
              threadId: match?.id,
              actorId: dbUserId,
              customerQuery: customerEmail || customerName,
              memberIds,
              title
            });
            match = connected?.thread || connected?.data || match;
          } else if (!match) {
            const created = await createThread({
              type: "group",
              createdBy: dbUserId,
              memberIds,
              title
            });
            match = created?.data;
          }
        }

        if (cancelled) return;
        setThread(match);
        if (match?.id) {
          const messagePayload = await fetchThreadMessages(match.id, { userId: dbUserId, limit: 100 });
          if (!cancelled) setMessages(messagePayload?.data || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load customer messages.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadThread();
    return () => {
      cancelled = true;
    };
  }, [customerEmail, customerName, dbUserId, title]);

  const handleSend = async () => {
    if (!thread?.id || !dbUserId || !draft.trim()) return;
    setSending(true);
    setError("");
    try {
      const payload = await sendThreadMessage(thread.id, {
        senderId: dbUserId,
        content: draft.trim(),
        metadata: { customerProfile: true, customerName }
      });
      setMessages((current) => [...current, payload?.data].filter(Boolean));
      setDraft("");
    } catch (err) {
      setError(err.message || "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  if (!dbUserId) {
    return <div style={{ color: "var(--text-1)" }}>Sign in to use customer messages.</div>;
  }

  return (
    <>

      {loading && <p style={{ margin: 0, color: "var(--text-1)" }}>Loading messages...</p>}
      {error && <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>}
      <div
        data-dev-section="1"
        data-dev-section-key="customer-profile-messages-feed"
        data-dev-section-type="section-shell"
        data-dev-section-parent="customer-profile-tab-messages"
        data-dev-background-token="surface"
        style={{ minHeight: "260px", maxHeight: "420px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", borderRadius: "var(--radius-md)", background: "var(--surface)", padding: "12px" }}>

        {!loading && !messages.length && <p style={{ margin: 0, color: "var(--text-1)" }}>No messages yet.</p>}
        {messages.map((message) => {
          const mine = Number(message.senderId) === Number(dbUserId);
          return (
            <LayerSurface as="div"
            key={message.id}

            data-dev-section="1"
            data-dev-section-key={`customer-profile-message-${message.id}`}
            data-dev-section-type="content-card"
            data-dev-section-parent="customer-profile-messages-feed"
            data-dev-background-token={mine ? "customer-profile-message-own" : "surface"}
            style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "min(680px, 88%)", padding: "10px 12px" }}>

              <div style={{ fontSize: "12px", color: "var(--text-1)", marginBottom: "4px" }}>{mine ? "You" : message.sender?.name || "Team member"} · {formatDateTime(message.createdAt)}</div>
              <div style={{ color: "var(--text-1)", whiteSpace: "pre-wrap" }}>{message.content}</div>
            </LayerSurface>);

        })}
      </div>
      <div
        data-dev-section="1"
        data-dev-section-key="customer-profile-messages-composer"
        data-dev-section-type="toolbar"
        data-dev-section-parent="customer-profile-tab-messages"
        data-dev-background-token="surface"
        style={{ display: "flex", gap: "10px", alignItems: "flex-end", border: "none", boxShadow: "none", outline: "none", borderRadius: "var(--radius-md)", background: "var(--surface)", padding: "12px" }}>

        <textarea
          ref={composerRef}
          rows={1}
          className="app-input app-input--textarea"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message the customer..."
          style={{ flex: 1, height: "42px", minHeight: "42px", maxHeight: "132px", resize: "none", overflowY: "hidden", lineHeight: "20px", border: "none", boxShadow: "none" }} />

        <button type="button" className="app-btn app-btn--primary" onClick={handleSend} disabled={sending || !draft.trim()}>
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </>);

};

/* ==========================================================================
   Container
   ========================================================================== */

const getSlugParam = (rawSlug) => {
  if (!rawSlug) return "";
  if (Array.isArray(rawSlug)) return rawSlug[0] || "";
  return rawSlug;
};

const getTabParam = (rawTab) => {
  if (!rawTab) return "";
  if (Array.isArray(rawTab)) return rawTab[0] || "";
  return rawTab;
};

const EMPTY_BUNDLE = {
  vehicles: [],
  jobs: [],
  paymentMethods: [],
  activityEvents: [],
  invoices: [],
  appointments: [],
  accounts: [],
  transactions: [],
};

export default function CustomerDetailWorkspace() {
  const router = useRouter();
  const { dbUserId, user } = useUser();
  const slugFromRoute = getSlugParam(router.query.customerSlug);
  const tabFromRoute = getTabParam(router.query.tab);

  const [customer, setCustomer] = useState(null);
  const [bundle, setBundle] = useState(EMPTY_BUNDLE);
  const [duplicates, setDuplicates] = useState([]);
  const [activeTab, setActiveTab] = useState(TAB_IDS[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingPreference, setSavingPreference] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  const access = useMemo(
    () => (user ? getCustomerRecordAccess(user.roles || []) : READ_ONLY_CUSTOMER_ACCESS),
    [user]
  );

  /* ---- Routing ------------------------------------------------------- */

  useEffect(() => {
    if (!tabFromRoute) return;
    const resolved = LEGACY_TAB_ALIASES[tabFromRoute] || tabFromRoute;
    if (!TAB_IDS.includes(resolved)) return;
    setActiveTab(resolved);
  }, [tabFromRoute]);

  /* ---- Load ---------------------------------------------------------- */

  const loadRecord = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      let record = await getCustomerBySlug(slugFromRoute);
      if (!record && isValidUuid(slugFromRoute)) {
        record = await getCustomerById(slugFromRoute);
      }

      if (!record) {
        setCustomer(null);
        setBundle(EMPTY_BUNDLE);
        setDuplicates([]);
        setError("Customer record was not found.");
        return;
      }

      const [loaded, possibleDuplicates] = await Promise.all([
        getCustomerRecordBundle(record.id),
        findDuplicateCustomers(record),
      ]);

      setCustomer(record);
      setBundle({ ...EMPTY_BUNDLE, ...loaded });
      setDuplicates(possibleDuplicates || []);
    } catch (err) {
      logFailure("Failed to load customer detail view:", err);
      setError("Unable to load customer data right now.");
    } finally {
      setIsLoading(false);
    }
  }, [slugFromRoute]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!slugFromRoute) {
      setError("Customer not found.");
      setIsLoading(false);
      return;
    }
    loadRecord();
  }, [router.isReady, slugFromRoute, loadRecord]);

  // Keep the URL on the readable name slug.
  useEffect(() => {
    if (isPresentationMode()) return;
    if (!router.isReady || !customer) return;
    const preferredSlug = createCustomerDisplaySlug(customer.firstname, customer.lastname);
    if (!preferredSlug) return;
    const desiredKey = normalizeCustomerSlug(preferredSlug);
    const currentKey = normalizeCustomerSlug(slugFromRoute);
    if (desiredKey && desiredKey !== currentKey) {
      router.replace(`/customers/${preferredSlug}`, undefined, { shallow: true });
    }
  }, [router, customer, slugFromRoute]);

  /* ---- View model ---------------------------------------------------- */

  const customerName = displayCustomerName(customer);
  const contactPreference = normalizeContactPreference(customer?.contact_preference);

  const invoices = useMemo(
    () => mergeCustomerInvoices({ jobs: bundle.jobs, invoices: bundle.invoices }),
    [bundle.jobs, bundle.invoices]
  );

  const appointments = useMemo(
    () => buildAppointments({ jobs: bundle.jobs, appointments: bundle.appointments }),
    [bundle.jobs, bundle.appointments]
  );

  const summary = useMemo(
    () =>
      buildCustomerSummary({
        customer,
        vehicles: bundle.vehicles,
        jobs: bundle.jobs,
        invoices,
        appointments,
        accounts: bundle.accounts,
        activityEvents: bundle.activityEvents,
      }),
    [customer, bundle.vehicles, bundle.jobs, bundle.accounts, bundle.activityEvents, invoices, appointments]
  );

  const alerts = useMemo(
    () =>
      buildCustomerAlerts({
        customer,
        vehicles: bundle.vehicles,
        jobs: bundle.jobs,
        invoices,
        summary,
        duplicates,
        activityEvents: bundle.activityEvents,
      }).filter((alert) => access.canViewFinancials || !/invoice|balance|credit/i.test(alert.id)),
    [customer, bundle.vehicles, bundle.jobs, bundle.activityEvents, invoices, summary, duplicates, access]
  );

  const files = useMemo(() => buildCustomerFiles(bundle.jobs), [bundle.jobs]);

  const historyEntries = useMemo(
    () =>
      buildHistoryTimeline({
        jobs: bundle.jobs,
        invoices: access.canViewFinancials ? invoices : [],
        appointments,
        vehicles: bundle.vehicles,
        activityEvents: bundle.activityEvents,
      }),
    [bundle.jobs, bundle.vehicles, bundle.activityEvents, invoices, appointments, access]
  );

  const activityEntries = useMemo(
    () =>
      buildActivityTimeline({
        activityEvents: bundle.activityEvents,
        vehicles: bundle.vehicles,
        jobs: bundle.jobs,
      }),
    [bundle.activityEvents, bundle.vehicles, bundle.jobs]
  );

  /* ---- Actions ------------------------------------------------------- */

  const refreshVehicles = useCallback(async () => {
    if (!customer?.id) return;
    const refreshed = await getCustomerVehicles(customer.id);
    setBundle((current) => ({ ...current, vehicles: refreshed || [] }));
  }, [customer?.id]);

  const appendActivity = useCallback((event) => {
    if (!event) return;
    setBundle((current) => ({ ...current, activityEvents: [event, ...current.activityEvents] }));
  }, []);

  const handleSaveCustomer = useCallback(
    async (values) => {
      if (!customer?.id || !access.canEditCustomer) return false;
      const result = await updateCustomer(customer.id, values);
      if (!result.success) return false;
      setCustomer(result.data);

      // Detail changes belong on the audit trail.
      const logged = await logCustomerActivity({
        customerId: customer.id,
        activityType: "customer_details_updated",
        payload: { fields: Object.keys(values || {}).join(", ") },
        createdBy: dbUserId || null,
      });
      if (logged.success) appendActivity(logged.data);
      return true;
    },
    [customer?.id, access.canEditCustomer, dbUserId, appendActivity]
  );

  const handleContactPreferenceChange = useCallback(
    async (value) => {
      if (!customer?.id || !access.canEditContactPreference) return;
      setSavingPreference(true);
      const result = await updateCustomer(customer.id, { contact_preference: value });
      if (result.success) {
        setCustomer(result.data);
        const logged = await logCustomerActivity({
          customerId: customer.id,
          activityType: "contact_preference_updated",
          payload: { preference: value || "not set" },
          createdBy: dbUserId || null,
        });
        if (logged.success) appendActivity(logged.data);
      }
      setSavingPreference(false);
    },
    [customer?.id, access.canEditContactPreference, dbUserId, appendActivity]
  );

  const handleAddLogEntry = useCallback(
    async ({ activityType, payload, jobId }) => {
      if (!customer?.id || !access.canAddNote) return false;
      const result = await logCustomerActivity({
        customerId: customer.id,
        activityType,
        payload,
        jobId,
        createdBy: dbUserId || null,
      });
      if (!result.success) return false;
      appendActivity(result.data);
      return true;
    },
    [customer?.id, access.canAddNote, dbUserId, appendActivity]
  );

  const handleOpenVehicleHistory = useCallback((registration) => {
    setHistorySearch(registration);
    setActiveTab("history");
  }, []);

  // "Needs attention" cards jump straight to whatever resolves them: the
  // Payments tab for money, the Activity tab for portal requests, or the
  // History tab pre-filtered to one registration.
  const handleAlertNavigate = useCallback((tab, search) => {
    if (!tab) return;
    if (search !== undefined) setHistorySearch(search || "");
    setActiveTab(tab);
  }, []);

  /* ---- Render -------------------------------------------------------- */

  const tabDefinitions = useMemo(
    () => [
      { id: "overview", label: "Overview", count: bundle.vehicles.length },
      { id: "history", label: "History", count: historyEntries.length },
      {
        id: "payments",
        label: "Payments",
        count: access.canViewFinancials ? invoices.length : null,
      },
      { id: "activity", label: "Activity", count: activityEntries.length },
      { id: "messages", label: "Messages", count: null },
    ],
    [bundle.vehicles.length, historyEntries.length, invoices.length, activityEntries.length, access]
  );

  const renderTabContent = () => {
    if (activeTab === "overview") {
      return (
        <CustomerOverviewTab
          customer={customer}
          summary={summary}
          vehicles={bundle.vehicles}
          jobs={bundle.jobs}
          appointments={appointments}
          files={files}
          activityEvents={bundle.activityEvents}
          access={access}
          onVehicleAdded={refreshVehicles}
          onOpenHistory={handleOpenVehicleHistory}
          onAddLogEntry={handleAddLogEntry}
        />
      );
    }
    if (activeTab === "history") {
      return <CustomerHistoryTab entries={historyEntries} initialSearch={historySearch} access={access} />;
    }
    if (activeTab === "payments") {
      return (
        <CustomerPaymentsTab
          invoices={invoices}
          paymentMethods={bundle.paymentMethods}
          transactions={bundle.transactions}
          summary={summary}
          access={access}
          onRecordAction={handleAddLogEntry}
        />
      );
    }
    if (activeTab === "activity") {
      return (
        <CustomerActivityTab
          entries={activityEntries}
          activityEvents={bundle.activityEvents}
          jobs={bundle.jobs}
          access={access}
          onAddLogEntry={handleAddLogEntry}
        />
      );
    }
    if (activeTab === "messages") {
      return (
        <CustomerMessagesTab
          customerName={customerName}
          customerEmail={customer?.email}
          dbUserId={dbUserId}
        />
      );
    }
    return null;
  };

  return (
    <CustomerDetailWorkspaceUi
      view="section1"
      PageSkeleton={PageSkeleton}
      TabGroup={TabGroup}
      tabDefinitions={tabDefinitions}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      customer={customer}
      error={error}
      isLoading={isLoading}
      renderTabContent={renderTabContent}
      search={<CustomerSearchBar currentCustomerId={customer?.id} />}
      alerts={
        <CustomerAlertsPanel
          alerts={alerts}
          duplicates={duplicates}
          onOpenTab={handleAlertNavigate}
        />
      }
      header={
        <CustomerHeaderCard
          customer={customer}
          summary={summary}
          access={access}
          contactPreference={contactPreference}
          savingPreference={savingPreference}
          onContactPreferenceChange={handleContactPreferenceChange}
          onSaveCustomer={handleSaveCustomer}
          customerSlug={slugFromRoute}
        />
      }
    />
  );
}
