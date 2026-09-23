// file location: src/pages/website/profile.js
// Customer-facing account portal at /website/profile.
//
// One bundled payload comes from /api/website/profile (vehicles + jobs +
// invoices + appointments + account + payment methods + booking requests +
// service history + VHC summaries + activity timeline + messages). This page
// owns that fetch, the shared /api/website/actions call and all portal state;
// the seven views under src/features/website/profile/ are presentation only
// and never fetch anything of their own.
//
// Structure (replaced the old 27-section "Jump to" page, 2026-09):
//   • the /website top bar, so the portal reads as part of the same site
//   • ProfilePortalNav IN that bar (2026-09): the portal's own seven views are
//     the bar's middle links, replacing the marketing links (Cars / Offers /
//     Service / Sell / Contact) a signed-in customer does not need here. The
//     active view is still mirrored into ?view=.
//   • a compact account greeting in the bar's second row
//   • exactly one view rendered beneath it
//
// Styling: the page renders inside html.website-scope (useWebsiteScope), so
// every raw control inherits the liquid-glass system in custglobal.css. All
// chrome is the ws-portal-* / ws-profile-* family (@family portal); nothing
// here carries inline paint.

import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTheme } from "@/styles/themeProvider";
import { siteContent } from "@/features/website/data/siteContent";
import useWebsiteScope from "@/features/website/hooks/useWebsiteScope";
import WebsiteTopBar from "@/features/website/components/WebsiteTopBar";
import { customerWebsiteGetLayout } from "@/components/layout/CustomerWebsiteLayout";
import { normalizeContactPreference } from "@/lib/customers/contactPreference";

import ProfilePortalNav, {
  PORTAL_VIEWS,
  isPortalView,
  panelId,
  tabId,
} from "@/features/website/profile/ProfilePortalNav";
import ProfileOverview from "@/features/website/profile/ProfileOverview";
import ProfileVehicles from "@/features/website/profile/ProfileVehicles";
import ProfileWorkshop from "@/features/website/profile/ProfileWorkshop";
import ProfileMoney from "@/features/website/profile/ProfileMoney";
import ProfileMessages from "@/features/website/profile/ProfileMessages";
import ProfileServices, { isService } from "@/features/website/profile/ProfileServices";
import ProfileAccount from "@/features/website/profile/ProfileAccount";
import {
  daysUntil,
  invoiceTotal,
  isOpenJob,
  isPaidInvoice,
  vehicleKey,
} from "@/features/website/profile/profileUtils";

// /website light/dark/system theme cycle. The choice is persisted to
// localStorage and applied by writing data-website-theme onto <html>;
// custglobal.css repaints the customer surface for whichever concrete theme is
// written. /website/profile is one of the two deliberate exceptions to the
// light-only customer site (see LIGHT_ONLY_WEBSITE_EXCEPTIONS in _document.js),
// so the cycle lives here rather than in useWebsiteTheme.
const WEBSITE_THEME_KEY = "hnp-website-theme";
const WEBSITE_THEME_CYCLE = ["light", "dark", "system"];

const resolveWebsiteTheme = (preference) => {
  if (preference === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    return "dark";
  }
  return preference;
};

// While the payload loads, the portal draws its own shape rather than a line
// of text, so the layout does not jump when the data lands.
function PortalSkeleton() {
  return (
    <div className="ws-profile-view" aria-busy="true">
      <p className="ws-portal-status">Loading your account…</p>
      <div className="ws-portal-split">
        <section className="ws-portal-card">
          <div className="ws-portal-card__header">
            <div className="ws-portal-eyebrow">Your vehicle</div>
          </div>
          <div className="ws-portal-progress">
            <div className="ws-portal-progress__fill" style={{ "--ws-portal-pct": "35%" }} />
          </div>
        </section>
        <section className="ws-portal-card">
          <div className="ws-portal-card__header">
            <div className="ws-portal-eyebrow">Workshop</div>
          </div>
          <div className="ws-portal-progress">
            <div className="ws-portal-progress__fill" style={{ "--ws-portal-pct": "20%" }} />
          </div>
        </section>
      </div>
    </div>
  );
}

export default function CustomerProfilePage() {
  const router = useRouter();
  const { setTemporaryOverride } = useTheme();
  useWebsiteScope();

  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstname: "",
    lastname: "",
    mobile: "",
    telephone: "",
    address: "",
    postcode: "",
    contact_preference: "email",
  });
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionFlash, setActionFlash] = useState({});
  const [websiteThemePref, setWebsiteThemePref] = useState("dark");

  // ── Portal state ──────────────────────────────────────────────────────
  // One active view, plus the secondary selection each view remembers. All of
  // it is plain React state; only the view is mirrored into the URL.
  const [activeView, setActiveView] = useState("overview");
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [vehicleSection, setVehicleSection] = useState("overview");
  const [moneySection, setMoneySection] = useState("invoices");
  const [messagesSection, setMessagesSection] = useState("messages");
  const [accountSection, setAccountSection] = useState("profile");
  const [selectedService, setSelectedService] = useState(null);

  // ?view= keeps refresh, back and forward honest. An unknown value falls
  // back to Overview rather than rendering nothing.
  useEffect(() => {
    if (!router.isReady) return;
    const queryView = String(router.query.view || "");
    setActiveView(isPortalView(queryView) ? queryView : "overview");
    const queryService = String(router.query.service || "");
    if (isService(queryService)) setSelectedService(queryService);
  }, [router.isReady, router.query.view, router.query.service]);

  const openView = useCallback(
    (view) => {
      if (!isPortalView(view)) return;
      setActiveView(view);
      const next = { ...router.query, view };
      // Overview is the default, so it stays out of the URL.
      if (view === "overview") delete next.view;
      router.replace({ pathname: router.pathname, query: next }, undefined, {
        shallow: true,
        scroll: false,
      });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    // router.query is read fresh each call; only the router identity matters.
    [router],
  );

  useEffect(() => {
    // The portal keeps its own light / dark / system cycle (see above), so the
    // semantic tokens follow whichever concrete mode is resolved rather than
    // the staff preference. Unwound on navigation away.
    setTemporaryOverride({ mode: resolveWebsiteTheme(websiteThemePref), accent: "red" });
    return () => setTemporaryOverride(null);
  }, [setTemporaryOverride, websiteThemePref]);

  // Load the saved /website theme preference once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(WEBSITE_THEME_KEY);
    if (stored && WEBSITE_THEME_CYCLE.includes(stored)) setWebsiteThemePref(stored);
  }, []);

  // Apply the resolved theme to <html> via data-website-theme, and when the
  // preference is "system" keep it in sync with the OS scheme. The attribute is
  // removed on navigation away so other /website pages keep their own default.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const apply = () => {
      document.documentElement.setAttribute("data-website-theme", resolveWebsiteTheme(websiteThemePref));
    };
    apply();
    let media;
    if (websiteThemePref === "system" && window.matchMedia) {
      media = window.matchMedia("(prefers-color-scheme: light)");
      media.addEventListener("change", apply);
    }
    return () => {
      if (media) media.removeEventListener("change", apply);
      document.documentElement.removeAttribute("data-website-theme");
    };
  }, [websiteThemePref]);

  const cycleWebsiteTheme = () => {
    setWebsiteThemePref((prev) => {
      const idx = WEBSITE_THEME_CYCLE.indexOf(prev);
      const next = WEBSITE_THEME_CYCLE[(idx + 1) % WEBSITE_THEME_CYCLE.length];
      if (typeof window !== "undefined") window.localStorage.setItem(WEBSITE_THEME_KEY, next);
      return next;
    });
  };

  // ── Data ──────────────────────────────────────────────────────────────

  const refresh = () =>
    fetch("/api/website/profile", { credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/website/login");
          return null;
        }
        return r.json();
      })
      .then((payload) => {
        if (!payload) return;
        if (!payload.success) {
          setStatus("error");
          return;
        }
        setData(payload);
        setEditForm({
          firstname: payload.customer.firstname || "",
          lastname: payload.customer.lastname || "",
          mobile: payload.customer.mobile || "",
          telephone: payload.customer.telephone || "",
          address: payload.customer.address || "",
          postcode: payload.customer.postcode || "",
          contact_preference: normalizeContactPreference(payload.customer.contact_preference) || "email",
        });
        setStatus("ready");
      })
      .catch(() => setStatus("error"));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (key, message) => {
    setActionFlash((prev) => ({ ...prev, [key]: message }));
    setTimeout(() => {
      setActionFlash((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 3500);
  };

  const handleLogout = async () => {
    await fetch("/api/website/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/website");
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveError("");
    setSaving(true);
    try {
      const res = await fetch("/api/website/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(editForm),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.message || "Could not save profile.");
      }
      setData((prev) => (prev ? { ...prev, customer: { ...prev.customer, ...payload.customer } } : prev));
      setEditing(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // The one customer-action call. Every view raises its requests through here,
  // so the /api/website/actions contract lives in a single place.
  const callAction = async (action, payload, flashKey, flashMessage) => {
    try {
      const res = await fetch("/api/website/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action, payload }),
      });
      const out = await res.json();
      if (!res.ok || !out.success) throw new Error(out.message || "Failed.");
      if (flashKey) flash(flashKey, flashMessage || "Request sent — we'll be in touch.");
      refresh();
    } catch (err) {
      if (flashKey) flash(flashKey, err.message);
    }
  };

  const handleAddVehicle = async (payload) => {
    try {
      const res = await fetch("/api/website/actions/add-vehicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (!res.ok || !out.success) throw new Error(out.message || "Could not add vehicle.");
      flash("addveh", "Vehicle added.");
      refresh();
      return { success: true };
    } catch (err) {
      flash("addveh", err.message);
      return { success: false, message: err.message };
    }
  };

  // ── Derived collections ───────────────────────────────────────────────

  const customer = data?.customer;
  const vehicles = useMemo(() => data?.vehicles || [], [data?.vehicles]);
  const jobs = useMemo(() => data?.jobs || [], [data?.jobs]);
  const invoices = useMemo(() => data?.invoices || [], [data?.invoices]);
  const appointments = useMemo(() => data?.appointments || [], [data?.appointments]);
  const accounts = useMemo(() => data?.accounts || [], [data?.accounts]);
  const paymentMethods = useMemo(() => data?.paymentMethods || [], [data?.paymentMethods]);
  const bookingRequests = useMemo(() => data?.bookingRequests || [], [data?.bookingRequests]);
  const jobHistory = useMemo(() => data?.jobHistory || [], [data?.jobHistory]);
  const vhcByJob = useMemo(() => data?.vhcByJob || {}, [data?.vhcByJob]);
  const vhcDeclinations = useMemo(() => data?.vhcDeclinations || [], [data?.vhcDeclinations]);
  const vhcMedia = useMemo(() => data?.vhcMedia || [], [data?.vhcMedia]);
  const vhcShareLinks = useMemo(() => data?.vhcShareLinks || [], [data?.vhcShareLinks]);
  const vhcSendHistory = useMemo(() => data?.vhcSendHistory || [], [data?.vhcSendHistory]);
  const transactions = useMemo(() => data?.transactions || [], [data?.transactions]);
  const jobStatusHistory = useMemo(() => data?.jobStatusHistory || [], [data?.jobStatusHistory]);
  const invoicePayments = useMemo(() => data?.invoicePayments || [], [data?.invoicePayments]);
  const paymentPlans = useMemo(() => data?.paymentPlans || [], [data?.paymentPlans]);
  const partsJobItems = useMemo(() => data?.partsJobItems || [], [data?.partsJobItems]);
  const partsOrderCards = useMemo(() => data?.partsOrderCards || [], [data?.partsOrderCards]);
  const timeline = useMemo(() => data?.timeline || [], [data?.timeline]);
  const messages = useMemo(() => data?.messages || [], [data?.messages]);

  const fullName = useMemo(() => {
    if (!customer) return "";
    return (
      [customer.firstname, customer.lastname].filter(Boolean).join(" ") ||
      customer.name ||
      customer.email ||
      "Your account"
    );
  }, [customer]);

  const firstName = useMemo(
    () => customer?.firstname || String(fullName).split(" ")[0] || "there",
    [customer, fullName],
  );

  const outstandingInvoices = useMemo(() => invoices.filter((i) => !isPaidInvoice(i)), [invoices]);
  const outstandingTotal = useMemo(
    () => outstandingInvoices.reduce((sum, i) => sum + invoiceTotal(i), 0),
    [outstandingInvoices],
  );

  // The soonest MOT that is close enough to be worth saying something about.
  const motSoonest = useMemo(() => {
    let best = null;
    for (const v of vehicles) {
      const days = daysUntil(v.mot_due);
      if (days == null) continue;
      if (!best || days < best.days) best = { vehicle: v, days };
    }
    return best && best.days <= 60 ? best : null;
  }, [vehicles]);

  // A vehicle counts as service-due when its last recorded visit is around a
  // year old — the same rule the old summary banner used.
  const serviceDue = useMemo(() => {
    const lastByVehicle = new Map();
    for (const h of jobHistory) {
      if (!h.vehicle_reg) continue;
      if (!lastByVehicle.has(h.vehicle_reg)) lastByVehicle.set(h.vehicle_reg, h);
    }
    for (const v of vehicles) {
      const last = v.reg_number ? lastByVehicle.get(v.reg_number) : null;
      if (!last) continue;
      const monthsSince = (Date.now() - new Date(last.recorded_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsSince >= 11) return { vehicle: v, last, months: Math.round(monthsSince) };
    }
    return null;
  }, [jobHistory, vehicles]);

  const activeJob = useMemo(() => jobs.find(isOpenJob) || null, [jobs]);

  const nextAppointment = useMemo(() => {
    const upcoming = appointments
      .filter((a) => {
        const t = new Date(a.scheduled_time).getTime();
        return Number.isFinite(t) && t >= Date.now() - 1000 * 60 * 60 * 12;
      })
      .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
    return upcoming[0] || null;
  }, [appointments]);

  const selectedVehicle = useMemo(() => {
    if (!vehicles.length) return null;
    return vehicles.find((v) => vehicleKey(v) === String(selectedVehicleId)) || vehicles[0];
  }, [vehicles, selectedVehicleId]);

  // Counts shown on the portal tabs — only things actually waiting on the
  // customer, so the bar stays quiet when nothing needs them.
  const tabCounts = useMemo(
    () => ({
      money: outstandingInvoices.length,
      vehicles: vhcDeclinations.length,
    }),
    [outstandingInvoices.length, vhcDeclinations.length],
  );

  const themeLabel = `Theme: ${websiteThemePref.charAt(0).toUpperCase()}${websiteThemePref.slice(1)}`;

  // ── View rendering ────────────────────────────────────────────────────

  const renderView = () => {
    switch (activeView) {
      case "vehicles":
        return (
          <ProfileVehicles
            vehicles={vehicles}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={(v) => setSelectedVehicleId(vehicleKey(v))}
            section={vehicleSection}
            onSectionChange={setVehicleSection}
            jobs={jobs}
            jobHistory={jobHistory}
            invoices={invoices}
            vhcByJob={vhcByJob}
            vhcDeclinations={vhcDeclinations}
            vhcMedia={vhcMedia}
            vhcShareLinks={vhcShareLinks}
            onApproveVhcItem={(item, index) =>
              callAction(
                "authorise_vhc_item",
                {
                  job_id: item.job_id,
                  issue_title: item.issue_title,
                  issue_description: item.issue_description,
                },
                `reauth-${item.job_id}-${index}`,
                "Sent — we'll be in touch to book it in.",
              )
            }
            onAddVehicle={handleAddVehicle}
            onMileageSaved={() => {
              flash("mileage", "Mileage updated.");
              refresh();
            }}
            actionFlash={actionFlash}
          />
        );
      case "workshop":
        return (
          <ProfileWorkshop
            customer={customer}
            activeJob={activeJob}
            jobs={jobs}
            appointments={appointments}
            bookingRequests={bookingRequests}
            jobStatusHistory={jobStatusHistory}
            vhcByJob={vhcByJob}
            vhcSendHistory={vhcSendHistory}
            partsJobItems={partsJobItems}
            partsOrderCards={partsOrderCards}
            openView={openView}
          />
        );
      case "money":
        return (
          <ProfileMoney
            accounts={accounts}
            invoices={invoices}
            outstandingInvoices={outstandingInvoices}
            outstandingTotal={outstandingTotal}
            invoicePayments={invoicePayments}
            paymentMethods={paymentMethods}
            paymentPlans={paymentPlans}
            transactions={transactions}
            section={moneySection}
            onSectionChange={setMoneySection}
            onPayInvoice={(invoice) =>
              callAction(
                "request_payment_link",
                { invoice_id: invoice.invoice_id },
                `pay-${invoice.invoice_id}`,
                "Payment link requested.",
              )
            }
            onRequestInvoicePdf={(invoice) =>
              callAction(
                "request_invoice_pdf",
                { invoice_id: invoice.invoice_id },
                `pdf-${invoice.invoice_id}`,
                "PDF requested — we'll email it.",
              )
            }
            onRequestStatement={(account) =>
              callAction(
                "request_statement",
                { account_id: account.account_id },
                `stmt-${account.account_id}`,
                "Statement requested.",
              )
            }
            actionFlash={actionFlash}
          />
        );
      case "messages":
        return (
          <ProfileMessages
            messages={messages}
            invoices={invoices}
            vhcMedia={vhcMedia}
            section={messagesSection}
            onSectionChange={setMessagesSection}
            onSend={(body) => callAction("send_message", { body }, "msg", "Message sent.")}
            actionFlash={actionFlash}
          />
        );
      case "services":
        return (
          <ProfileServices
            vehicles={vehicles}
            bookingRequests={bookingRequests}
            selectedService={selectedService}
            onSelectService={setSelectedService}
            onBookService={(payload) =>
              callAction("book_service", payload, "book", "Booking request sent — we'll confirm soon.")
            }
            onServiceRequest={(action, payload, label) =>
              callAction(action, payload, "svcq", `${label} request sent.`)
            }
            onSellCar={(payload) => callAction("request_valuation", payload, "sell", "Valuation request sent.")}
            onShowroomCallback={(payload) =>
              callAction("request_vehicle_callback", payload, "show", "Callback request sent.")
            }
            actionFlash={actionFlash}
          />
        );
      case "account":
        return (
          <ProfileAccount
            customer={customer}
            fullName={fullName}
            vehicles={vehicles}
            timeline={timeline}
            section={accountSection}
            onSectionChange={setAccountSection}
            editing={editing}
            onEditingChange={(value) => {
              setEditing(value);
              if (!value) setSaveError("");
            }}
            editForm={editForm}
            onEditFormChange={setEditForm}
            onSaveProfile={handleSaveProfile}
            saving={saving}
            saveError={saveError}
            themeLabel={themeLabel}
            onCycleTheme={cycleWebsiteTheme}
            onLogout={handleLogout}
            onFlash={flash}
            onRefresh={refresh}
            onReferral={(payload) =>
              callAction("refer_friend", payload, "ref", "Thanks — we'll be in touch with your friend.")
            }
            onExportData={() =>
              callAction("request_data_export", {}, "exp", "Data export requested — we'll email it.")
            }
            onDeleteAccount={() =>
              callAction("request_account_deletion", {}, "del", "Deletion request submitted.")
            }
            actionFlash={actionFlash}
          />
        );
      case "overview":
      default:
        return (
          <ProfileOverview
            vehicles={vehicles}
            activeJob={activeJob}
            motSoonest={motSoonest}
            serviceDue={serviceDue}
            outstandingInvoices={outstandingInvoices}
            outstandingTotal={outstandingTotal}
            nextAppointment={nextAppointment}
            pendingApprovals={vhcDeclinations}
            messages={messages}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={(v) => setSelectedVehicleId(vehicleKey(v))}
            openView={openView}
            onBookMot={(vehicle) =>
              callAction(
                "book_service",
                {
                  description: `MOT booking request for ${vehicle.reg_number}`,
                  vehicle_id: vehicle.vehicle_id,
                },
                "mot",
                "MOT request sent — we'll confirm by email.",
              )
            }
            onBookService={(vehicle) =>
              callAction(
                "book_service",
                {
                  description: `Service booking request for ${vehicle.reg_number}`,
                  vehicle_id: vehicle.vehicle_id,
                },
                "svc",
                "Service request sent — we'll be in touch.",
              )
            }
            actionFlash={actionFlash}
          />
        );
    }
  };

  const activeLabel = PORTAL_VIEWS.find((v) => v.id === activeView)?.label || "Overview";

  return (
    <>
      <Head>
        <title>{`Your account - ${siteContent.brand.name}`}</title>
      </Head>
      <div className="ws-page">
        {/* The same top bar every /website page uses: brand, the links for the
            page the visitor is on, the phone number and the account control.
            Here those middle links ARE the portal's seven views, so changing
            view never means scrolling back up to a second navigation strip.
            No `menu` is passed: the tab group has to stay visible on a phone
            (it scrolls sideways) rather than collapse behind a hamburger. */}
        <WebsiteTopBar
          label="Portal"
          className="ws-portal-navbar"
          dataPresentation="website-profile-nav"
          sessionLoading={status === "loading"}
          customer={customer}
          subbar={
            status === "ready" && customer ? (
              <div data-presentation="website-profile-header" className="ws-portal-topbar">
                <div>
                  <span className="ws-portal-eyebrow">Customer portal</span>
                  <h1 className="ws-portal-title">Hello, {firstName}</h1>
                  <p className="ws-portal-subtitle">
                    Everything for your vehicles and account in one place.
                  </p>
                </div>
                <div className="ws-portal-header__actions">
                  <button
                    type="button"
                    onClick={cycleWebsiteTheme}
                    aria-label={`${themeLabel}. Press to cycle light, dark and system.`}
                  >
                    {themeLabel}
                  </button>
                  <button type="button" className="app-btn" onClick={handleLogout}>
                    Log out
                  </button>
                </div>
              </div>
            ) : null
          }
        >
          {status === "ready" && customer ? (
            <ProfilePortalNav activeView={activeView} onSelect={openView} counts={tabCounts} />
          ) : null}
        </WebsiteTopBar>

        <div data-presentation="website-profile" className="ws-portal-shell">
          <main className="ws-portal-main">
            {status === "loading" ? (
              <PortalSkeleton />
            ) : status === "error" || !customer ? (
              <p className="ws-portal-status">
                We could not load your account just now.{" "}
                <Link href="/website/login" className="ws-portal-link">
                  Sign in again
                </Link>
                .
              </p>
            ) : (
              <div
                id={panelId(activeView)}
                role="tabpanel"
                aria-labelledby={tabId(activeView)}
                aria-label={activeLabel}
                tabIndex={-1}
              >
                {renderView()}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

CustomerProfilePage.getLayout = customerWebsiteGetLayout;
