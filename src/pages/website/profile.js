// file location: src/pages/website/profile.js
// Customer-facing portal page. Pulls one bundled payload from
// /api/website/profile (vehicles + jobs + invoices + appointments +
// account + payment methods + booking requests + service history +
// VHC summaries + activity timeline + messages) and surfaces it as a
// set of cards. Actions that need staff intervention (book service,
// pay invoice, request statement / PDF / data export / deletion,
// send a message) are written to public.customer_activity_events via
// /api/website/actions so existing staff workflows can pick them up.

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTheme } from "@/styles/themeProvider";
import { siteContent } from "@/singlescroll/data/siteContent";
import useWebsiteScope from "@/singlescroll/hooks/useWebsiteScope";
import WebsiteSelect from "@/singlescroll/components/WebsiteSelect";
import WebsiteDatePicker from "@/singlescroll/components/WebsiteDatePicker";
import styles from "@/singlescroll/styles/singlescroll.module.css";

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
};

const daysUntil = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
};

// Build the live-status tracker stages for a specific job. The VHC
// step is only included when the job has vhc_required = true so jobs
// that skip the inspection don't show a phantom step that will never
// tick over. Wash is derived from wash_started_at (in progress) and
// either wash_completed_by being set or completed_at falling after
// wash_started_at (done).
const getTrackerStages = (job) => {
  const stages = [
    { key: "booked", label: "Booked", reached: !!job.created_at },
    {
      key: "checked_in",
      label: "Checked in",
      reached: !!job.checked_in_at,
    },
    {
      key: "in_workshop",
      label: "In workshop",
      reached: !!job.workshop_started_at,
    },
  ];
  if (job.vhc_required) {
    stages.push({
      key: "vhc",
      label: "VHC done",
      reached: !!job.vhc_completed_at,
    });
  }
  const washDone =
    !!job.wash_completed_by ||
    (job.completed_at &&
      job.wash_started_at &&
      new Date(job.completed_at).getTime() >=
        new Date(job.wash_started_at).getTime());
  stages.push({
    key: "wash",
    label: "Wash done",
    reached: washDone,
  });
  const status = (job.status || "").toLowerCase();
  const ready =
    !!job.completed_at ||
    ["ready", "completed", "collected", "invoiced"].some((s) =>
      status.includes(s),
    );
  stages.push({ key: "ready", label: "Ready", reached: ready });
  return stages;
};

const getActiveStageIndex = (stages) => {
  for (let i = stages.length - 1; i >= 0; i -= 1) {
    if (stages[i].reached) return i;
  }
  return 0;
};

const humaniseActivity = (event) => {
  const t = (event.activity_type || "").replace(/_/g, " ");
  const payload = event.activity_payload || {};
  if (payload.summary) return payload.summary;
  if (payload.description) return payload.description;
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "vehicles", label: "Vehicles" },
  { id: "jobs", label: "Jobs" },
  { id: "inspections", label: "Inspections" },
  { id: "invoices", label: "Money" },
  { id: "messages", label: "Messages" },
  { id: "book", label: "Book" },
  { id: "services", label: "Services" },
  { id: "sell", label: "Sell" },
  { id: "showroom", label: "Showroom" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
];

const SERVICE_TYPES = [
  {
    id: "body_repair",
    title: "Body work",
    hint: "Dents, scratches, panel repair, paint.",
    action: "request_body_repair",
  },
  {
    id: "smart_repair",
    title: "SMART repair",
    hint: "Small / medium area repair — fast turnaround.",
    action: "request_smart_repair",
  },
  {
    id: "valet",
    title: "Valet",
    hint: "Mini, full or deep-clean valet packages.",
    action: "request_valet",
  },
  {
    id: "parts",
    title: "Parts",
    hint: "Genuine parts & accessories enquiry.",
    action: "request_parts_enquiry",
  },
  {
    id: "warranty",
    title: "Warranty claim",
    hint: "Open a claim against your manufacturer warranty.",
    action: "request_warranty_claim",
  },
  {
    id: "motability",
    title: "Motability",
    hint: "Motability scheme advice & applications.",
    action: "request_motability",
  },
  {
    id: "finance",
    title: "Finance quote",
    hint: "PCP, HP or lease quote on a vehicle.",
    action: "request_finance_quote",
  },
  {
    id: "test_drive",
    title: "Test drive",
    hint: "Book a test drive in a specific model.",
    action: "request_test_drive",
  },
];

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

  useEffect(() => {
    setTemporaryOverride({ mode: "dark", accent: "red" });
    return () => setTemporaryOverride(null);
  }, [setTemporaryOverride]);

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
          contact_preference: payload.customer.contact_preference || "email",
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
    await fetch("/api/website/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
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
      setData((prev) =>
        prev ? { ...prev, customer: { ...prev.customer, ...payload.customer } } : prev,
      );
      setEditing(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

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

  const customer = data?.customer;
  const vehicles = data?.vehicles || [];
  const jobs = data?.jobs || [];
  const invoices = data?.invoices || [];
  const appointments = data?.appointments || [];
  const accounts = data?.accounts || [];
  const paymentMethods = data?.paymentMethods || [];
  const bookingRequests = data?.bookingRequests || [];
  const jobHistory = data?.jobHistory || [];
  const vhcByJob = data?.vhcByJob || {};
  const timeline = data?.timeline || [];
  const messages = data?.messages || [];

  const fullName = useMemo(() => {
    if (!customer) return "";
    return (
      [customer.firstname, customer.lastname].filter(Boolean).join(" ") ||
      customer.name ||
      customer.email ||
      "Your account"
    );
  }, [customer]);

  const outstandingInvoices = useMemo(
    () =>
      invoices.filter(
        (i) =>
          !(
            i.paid === true ||
            (i.payment_status || "").toLowerCase() === "paid"
          ),
      ),
    [invoices],
  );
  const outstandingTotal = useMemo(
    () =>
      outstandingInvoices.reduce(
        (sum, i) => sum + Number(i.grand_total ?? i.total ?? 0),
        0,
      ),
    [outstandingInvoices],
  );

  // MOT countdown — pick the nearest MOT among the customer's vehicles.
  const motSoonest = useMemo(() => {
    let best = null;
    for (const v of vehicles) {
      const days = daysUntil(v.mot_due);
      if (days == null) continue;
      if (!best || days < best.days) best = { vehicle: v, days };
    }
    return best;
  }, [vehicles]);

  // Service due — from the most recent customer_job_history entry per
  // vehicle. We treat 12 months since last service as "due".
  const serviceDue = useMemo(() => {
    const lastByVehicle = new Map();
    for (const h of jobHistory) {
      if (!h.vehicle_reg) continue;
      if (!lastByVehicle.has(h.vehicle_reg)) {
        lastByVehicle.set(h.vehicle_reg, h);
      }
    }
    for (const v of vehicles) {
      const last = v.reg_number ? lastByVehicle.get(v.reg_number) : null;
      if (!last) continue;
      const monthsSince =
        (Date.now() - new Date(last.recorded_at).getTime()) /
        (1000 * 60 * 60 * 24 * 30);
      if (monthsSince >= 11) {
        return { vehicle: v, last, months: Math.round(monthsSince) };
      }
    }
    return null;
  }, [jobHistory, vehicles]);

  // Active job for the live tracker — the most recent non-completed.
  const activeJob = useMemo(() => {
    return (
      jobs.find((j) => {
        const s = (j.status || "").toLowerCase();
        return !s.includes("completed") && !s.includes("collected");
      }) || jobs[0]
    );
  }, [jobs]);

  // Mileage history per vehicle for the small bar list.
  const mileageRows = useMemo(() => {
    const max = Math.max(
      1,
      ...jobHistory
        .map((h) => Number(h.mileage_at_service))
        .filter((n) => Number.isFinite(n) && n > 0),
    );
    return jobHistory
      .filter((h) => Number(h.mileage_at_service) > 0)
      .slice(0, 10)
      .map((h) => ({
        ...h,
        pct: Math.min(100, (Number(h.mileage_at_service) / max) * 100),
      }));
  }, [jobHistory]);

  return (
    <>
      <Head>
        <title>Your account — {siteContent.brand.name}</title>
      </Head>
      <div className={styles.profileShell}>
        <main className={styles.profileMain}>
          {status === "loading" ? (
            <p className={styles.profileLoading}>Loading your account…</p>
          ) : status === "error" || !customer ? (
            <p className={styles.profileLoading}>
              Could not load your account.{" "}
              <Link
                href="/website/login"
                style={{ color: "var(--accentText)" }}
              >
                Sign in again
              </Link>
              .
            </p>
          ) : (
            <>
              <header className={styles.profileHeader}>
                <div className={styles.profileHeaderText}>
                  <span className={styles.profileEyebrow}>Customer portal</span>
                  <h1 className={styles.profileTitle}>Hello, {fullName}</h1>
                  <p className={styles.profileSubtitle}>
                    Your vehicles, jobs, invoices, messages and account
                    settings — all in one place.
                  </p>
                </div>
                <div className={styles.profileActions}>
                  <Link
                    href="/website"
                    className={`app-btn ${styles.profileGhostBtn}`}
                  >
                    Back to site
                  </Link>
                  <button
                    type="button"
                    className={`app-btn ${styles.profileLogoutBtn}`}
                    onClick={handleLogout}
                  >
                    Log out
                  </button>
                </div>
              </header>

              <nav className={styles.profileJumpNav} aria-label="Sections">
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={styles.profileJumpLink}
                  >
                    {s.label}
                  </a>
                ))}
              </nav>

              {/* ───────── Summary banners ───────── */}
              <div id="summary" className={styles.profileGrid}>
                {motSoonest ? (
                  <section
                    className={`${styles.profileBanner} ${
                      motSoonest.days < 0
                        ? styles.profileBannerWarn
                        : motSoonest.days <= 30
                        ? styles.profileBannerWarn
                        : motSoonest.days <= 60
                        ? styles.profileBannerSoft
                        : ""
                    } ${styles.profileCardWide}`}
                  >
                    <div className={styles.profileBannerText}>
                      <span className={styles.profileBannerTitle}>
                        {motSoonest.days < 0
                          ? `MOT overdue on ${motSoonest.vehicle.reg_number}`
                          : `MOT due in ${motSoonest.days} day${motSoonest.days === 1 ? "" : "s"} — ${motSoonest.vehicle.reg_number}`}
                      </span>
                      <span className={styles.profileBannerSub}>
                        Expires {formatDate(motSoonest.vehicle.mot_due)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        callAction(
                          "book_service",
                          {
                            description: `MOT booking request for ${motSoonest.vehicle.reg_number}`,
                            vehicle_id: motSoonest.vehicle.vehicle_id,
                          },
                          "mot",
                          "MOT request sent — we'll confirm by email.",
                        )
                      }
                    >
                      Book MOT
                    </button>
                    {actionFlash.mot ? (
                      <p className={styles.profileSuccess}>{actionFlash.mot}</p>
                    ) : null}
                  </section>
                ) : null}

                {serviceDue ? (
                  <section
                    className={`${styles.profileBanner} ${styles.profileBannerSoft} ${styles.profileCardWide}`}
                  >
                    <div className={styles.profileBannerText}>
                      <span className={styles.profileBannerTitle}>
                        Service due — {serviceDue.vehicle.reg_number}
                      </span>
                      <span className={styles.profileBannerSub}>
                        Last service {serviceDue.months} months ago.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        callAction(
                          "book_service",
                          {
                            description: `Service booking request for ${serviceDue.vehicle.reg_number}`,
                            vehicle_id: serviceDue.vehicle.vehicle_id,
                          },
                          "svc",
                          "Service request sent — we'll be in touch.",
                        )
                      }
                    >
                      Book service
                    </button>
                    {actionFlash.svc ? (
                      <p className={styles.profileSuccess}>{actionFlash.svc}</p>
                    ) : null}
                  </section>
                ) : null}

                {/* Live job tracker */}
                {activeJob ? (
                  <section
                    className={`${styles.profileCard} ${styles.profileCardWide}`}
                  >
                    <div className={styles.profileCardHeader}>
                      <h2 className={styles.profileCardTitle}>
                        Live status — {activeJob.job_number || `Job #${activeJob.id}`}
                      </h2>
                      <span className={styles.profileBadge}>
                        {activeJob.status || "—"}
                      </span>
                    </div>
                    <p className={styles.profileItemMeta}>
                      {[activeJob.vehicle_reg, activeJob.vehicle_make_model]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <ActiveJobTags
                      job={activeJob}
                      bookingRequest={bookingRequests.find(
                        (r) => r.job_id === activeJob.id,
                      )}
                      vhcSent={
                        (data.vhcSendHistory || []).find(
                          (s) => s.job_id === activeJob.id,
                        ) || null
                      }
                    />
                    {(() => {
                      const stages = getTrackerStages(activeJob);
                      const active = getActiveStageIndex(stages);
                      return (
                        <div
                          className={styles.profileTracker}
                          style={{
                            gridTemplateColumns: `repeat(${stages.length}, 1fr)`,
                          }}
                        >
                          {stages.map((stage, idx) => {
                            const className =
                              idx < active
                                ? styles.profileTrackerStepDone
                                : idx === active && stage.reached
                                ? styles.profileTrackerStepActive
                                : "";
                            return (
                              <div
                                key={stage.key}
                                className={`${styles.profileTrackerStep} ${className}`}
                              >
                                <span className={styles.profileTrackerDot} />
                                <span>{stage.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </section>
                ) : null}
              </div>

              {/* ───────── Personal details ───────── */}
              <section
                className={`${styles.profileCard} ${styles.profileCardWide}`}
              >
                <div className={styles.profileCardHeader}>
                  <h2 className={styles.profileCardTitle}>Personal details</h2>
                  {!editing ? (
                    <button
                      type="button"
                      className={`app-btn ${styles.profileGhostBtn}`}
                      onClick={() => setEditing(true)}
                    >
                      Edit
                    </button>
                  ) : null}
                </div>

                {editing ? (
                  <form
                    className={styles.authForm}
                    onSubmit={handleSaveProfile}
                  >
                    {saveError ? (
                      <p className={styles.authError}>{saveError}</p>
                    ) : null}
                    <div className={styles.authRow}>
                      <FieldInput
                        label="First name"
                        value={editForm.firstname}
                        onChange={(v) =>
                          setEditForm({ ...editForm, firstname: v })
                        }
                      />
                      <FieldInput
                        label="Last name"
                        value={editForm.lastname}
                        onChange={(v) =>
                          setEditForm({ ...editForm, lastname: v })
                        }
                      />
                    </div>
                    <div className={styles.authRow}>
                      <FieldInput
                        label="Mobile"
                        value={editForm.mobile}
                        onChange={(v) => setEditForm({ ...editForm, mobile: v })}
                      />
                      <FieldInput
                        label="Telephone"
                        value={editForm.telephone}
                        onChange={(v) =>
                          setEditForm({ ...editForm, telephone: v })
                        }
                      />
                    </div>
                    <FieldInput
                      label="Address"
                      value={editForm.address}
                      onChange={(v) => setEditForm({ ...editForm, address: v })}
                    />
                    <div className={styles.authRow}>
                      <FieldInput
                        label="Postcode"
                        value={editForm.postcode}
                        onChange={(v) =>
                          setEditForm({ ...editForm, postcode: v })
                        }
                      />
                      <div className={styles.authField}>
                        <label className={styles.authLabel}>
                          Contact preference
                        </label>
                        <WebsiteSelect
                          value={editForm.contact_preference}
                          onChange={(v) =>
                            setEditForm({ ...editForm, contact_preference: v })
                          }
                          options={[
                            { value: "email", label: "Email" },
                            { value: "phone", label: "Phone" },
                            { value: "sms", label: "SMS" },
                            { value: "post", label: "Post" },
                          ]}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="submit"
                        className={`app-btn ${styles.authSubmit}`}
                        disabled={saving}
                        style={{ flex: 1 }}
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                      <button
                        type="button"
                        className={`app-btn ${styles.profileGhostBtn}`}
                        onClick={() => {
                          setEditing(false);
                          setSaveError("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className={styles.profileDetailGrid}>
                    <DetailField label="Name" value={fullName} />
                    <DetailField label="Email" value={customer.email} />
                    <DetailField label="Mobile" value={customer.mobile} />
                    <DetailField label="Telephone" value={customer.telephone} />
                    <DetailField label="Address" value={customer.address} />
                    <DetailField label="Postcode" value={customer.postcode} />
                    <DetailField
                      label="Preferred contact"
                      value={customer.contact_preference}
                    />
                  </div>
                )}
              </section>

              {/* ───────── Vehicles ───────── */}
              <section id="vehicles" className={styles.profileCard}>
                <div className={styles.profileCardHeader}>
                  <h2 className={styles.profileCardTitle}>Your vehicles</h2>
                  <span className={styles.profileCardCount}>
                    {vehicles.length}
                  </span>
                </div>
                {vehicles.length === 0 ? (
                  <p className={styles.profileEmpty}>
                    No vehicles linked to your account yet. Get in touch and
                    we'll add them.
                  </p>
                ) : (
                  <ul className={styles.profileItemList}>
                    {vehicles.map((v) => {
                      const motDays = daysUntil(v.mot_due);
                      const warrantyDays = daysUntil(v.warranty_expiry);
                      return (
                        <li
                          key={v.vehicle_id}
                          className={styles.profileItemRow}
                          style={{ gridTemplateColumns: "1fr" }}
                        >
                          <div>
                            <div className={styles.profileItemTitle}>
                              {v.reg_number || "—"} ·{" "}
                              {[v.make, v.model].filter(Boolean).join(" ") ||
                                "Vehicle"}
                            </div>
                            <div className={styles.profileItemMeta}>
                              {[
                                v.year && `${v.year}`,
                                v.colour,
                                v.fuel_type,
                                v.transmission,
                                v.mileage && `${v.mileage} mi`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                            <div
                              className={styles.profileItemMeta}
                              style={{ marginTop: 6 }}
                            >
                              {v.mot_due
                                ? `MOT ${motDays != null && motDays < 0 ? `overdue (${formatDate(v.mot_due)})` : `due ${formatDate(v.mot_due)}`}`
                                : "MOT date on file: —"}
                              {v.warranty_expiry
                                ? ` · Warranty ${warrantyDays != null && warrantyDays < 0 ? "expired" : `until ${formatDate(v.warranty_expiry)}`}`
                                : ""}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Add vehicle + update mileage */}
              <section className={styles.profileCard}>
                <div className={styles.profileCardHeader}>
                  <h2 className={styles.profileCardTitle}>
                    Update your vehicles
                  </h2>
                </div>
                <UpdateMileageRow
                  vehicles={vehicles}
                  onSaved={() => {
                    flash("mileage", "Mileage updated.");
                    refresh();
                  }}
                  flash={actionFlash.mileage}
                />
                <AddVehicleRow
                  onSubmit={(payload) =>
                    callAction(
                      "add_vehicle_request",
                      payload,
                      "addveh",
                      "Vehicle add request sent.",
                    )
                  }
                  flash={actionFlash.addveh}
                />
              </section>

              {/* Mileage history */}
              {mileageRows.length > 0 ? (
                <section className={styles.profileCard}>
                  <div className={styles.profileCardHeader}>
                    <h2 className={styles.profileCardTitle}>Mileage history</h2>
                  </div>
                  <div className={styles.profileMileageList}>
                    {mileageRows.map((row) => (
                      <div
                        key={row.history_id}
                        className={styles.profileMileageRow}
                      >
                        <span>{formatDate(row.recorded_at)}</span>
                        <span className={styles.profileMileageBar}>
                          <span
                            className={styles.profileMileageBarFill}
                            style={{ width: `${row.pct}%` }}
                          />
                        </span>
                        <span className={styles.profileMileageValue}>
                          {Number(row.mileage_at_service).toLocaleString()} mi
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* ───────── Jobs + VHC ───────── */}
              <section id="jobs" className={styles.profileCard}>
                <div className={styles.profileCardHeader}>
                  <h2 className={styles.profileCardTitle}>
                    Jobs & service history
                  </h2>
                  <span className={styles.profileCardCount}>{jobs.length}</span>
                </div>
                {jobs.length === 0 ? (
                  <p className={styles.profileEmpty}>
                    No jobs on file yet.
                  </p>
                ) : (
                  <ul className={styles.profileItemList}>
                    {jobs.slice(0, 20).map((j) => {
                      const vhc = vhcByJob[j.id];
                      return (
                        <li key={j.id} className={styles.profileItemRow}>
                          <div>
                            <div className={styles.profileItemTitle}>
                              {j.job_number || `Job #${j.id}`} ·{" "}
                              {j.type || "Service"}
                            </div>
                            <div className={styles.profileItemMeta}>
                              {[
                                j.vehicle_reg,
                                j.vehicle_make_model,
                                formatDate(j.created_at),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                            {vhc ? (
                              <div
                                className={styles.profileVhcLights}
                                style={{ marginTop: 6 }}
                              >
                                {vhc.red ? (
                                  <span
                                    className={`${styles.profileVhcLight} ${styles.profileVhcLightRed}`}
                                  >
                                    <span className={styles.profileVhcLightDot} />
                                    {vhc.red}
                                  </span>
                                ) : null}
                                {vhc.amber ? (
                                  <span
                                    className={`${styles.profileVhcLight} ${styles.profileVhcLightAmber}`}
                                  >
                                    <span className={styles.profileVhcLightDot} />
                                    {vhc.amber}
                                  </span>
                                ) : null}
                                {vhc.green ? (
                                  <span
                                    className={`${styles.profileVhcLight} ${styles.profileVhcLightGreen}`}
                                  >
                                    <span className={styles.profileVhcLightDot} />
                                    {vhc.green}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <span className={styles.profileBadge}>
                            {j.status || "—"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {appointments.length > 0 ? (
                <section className={styles.profileCard}>
                  <div className={styles.profileCardHeader}>
                    <h2 className={styles.profileCardTitle}>Appointments</h2>
                    <span className={styles.profileCardCount}>
                      {appointments.length}
                    </span>
                  </div>
                  <ul className={styles.profileItemList}>
                    {appointments.map((a) => (
                      <li
                        key={a.appointment_id}
                        className={styles.profileItemRow}
                      >
                        <div>
                          <div className={styles.profileItemTitle}>
                            {formatDateTime(a.scheduled_time)}
                          </div>
                          <div className={styles.profileItemMeta}>
                            {a.job_id ? `Job #${a.job_id} · ` : ""}
                            {a.status || "Booked"}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* ───────── Inspections (VHC media + items you declined) ───────── */}
              {(data.vhcMedia?.length || 0) > 0 ||
              (data.vhcDeclinations?.length || 0) > 0 ? (
                <section id="inspections" className={styles.profileCard}>
                  <div className={styles.profileCardHeader}>
                    <h2 className={styles.profileCardTitle}>
                      Inspection photos & video
                    </h2>
                    <span className={styles.profileCardCount}>
                      {data.vhcMedia?.length || 0}
                    </span>
                  </div>
                  {(data.vhcMedia?.length || 0) === 0 ? (
                    <p className={styles.profileEmpty}>
                      No media yet — uploaded inspection photos will appear here.
                    </p>
                  ) : (
                    <div className={styles.profileMediaGrid}>
                      {(data.vhcMedia || []).slice(0, 16).map((m) => (
                        <a
                          key={m.id}
                          href={m.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.profileMediaThumb}
                        >
                          {m.media_type === "video" ? (
                            <video src={m.public_url} muted preload="metadata" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.public_url} alt={m.context_label || ""} />
                          )}
                          <span className={styles.profileMediaTag}>
                            {m.media_type === "video" ? "Video" : "Photo"}
                          </span>
                          {m.context_label ? (
                            <span className={styles.profileMediaCaption}>
                              {m.context_label}
                            </span>
                          ) : null}
                        </a>
                      ))}
                    </div>
                  )}

                  {(data.vhcDeclinations?.length || 0) > 0 ? (
                    <div style={{ marginTop: 14 }}>
                      <p className={styles.profileSettingsHint}>
                        Items you previously declined — want to revisit?
                      </p>
                      <ul className={styles.profileItemList}>
                        {(data.vhcDeclinations || [])
                          .slice(0, 8)
                          .map((d, idx) => (
                            <li
                              key={`${d.job_id}-${idx}`}
                              className={styles.profileItemRow}
                            >
                              <div>
                                <div className={styles.profileItemTitle}>
                                  {d.issue_title || d.section || "Item"}
                                </div>
                                {d.issue_description ? (
                                  <div className={styles.profileItemMeta}>
                                    {d.issue_description}
                                  </div>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  callAction(
                                    "authorise_vhc_item",
                                    {
                                      job_id: d.job_id,
                                      issue_title: d.issue_title,
                                      issue_description: d.issue_description,
                                    },
                                    `reauth-${d.job_id}-${idx}`,
                                    "Sent — we'll be in touch to schedule.",
                                  )
                                }
                              >
                                Authorise now
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {/* ───────── Money / Account / Invoices ───────── */}
              <div id="invoices" className={styles.profileGrid}>
                {accounts.length > 0
                  ? accounts.map((a) => (
                      <section key={a.account_id} className={styles.profileCard}>
                        <div className={styles.profileCardHeader}>
                          <h2 className={styles.profileCardTitle}>
                            {a.account_type || "Account"} #{a.account_id}
                          </h2>
                          <span className={styles.profileBadge}>
                            {a.status || "Active"}
                          </span>
                        </div>
                        <div className={styles.profileBalanceHero}>
                          <span className={styles.profileBalanceFigure}>
                            {formatCurrency(a.balance)}
                          </span>
                          <span className={styles.profileBalanceMeta}>
                            Credit limit {formatCurrency(a.credit_limit)} ·{" "}
                            {a.credit_terms ?? 30}-day terms
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() =>
                              callAction(
                                "request_statement",
                                { account_id: a.account_id },
                                `stmt-${a.account_id}`,
                                "Statement requested.",
                              )
                            }
                          >
                            Request statement
                          </button>
                        </div>
                        {actionFlash[`stmt-${a.account_id}`] ? (
                          <p className={styles.profileSuccess}>
                            {actionFlash[`stmt-${a.account_id}`]}
                          </p>
                        ) : null}
                      </section>
                    ))
                  : null}

                <section className={styles.profileCard}>
                  <div className={styles.profileCardHeader}>
                    <h2 className={styles.profileCardTitle}>Invoices</h2>
                    <span className={styles.profileCardCount}>
                      {invoices.length}
                    </span>
                  </div>
                  <div className={styles.profileBalanceHero}>
                    <span className={styles.profileBalanceFigure}>
                      {formatCurrency(outstandingTotal)}
                    </span>
                    <span className={styles.profileBalanceMeta}>
                      Outstanding across {outstandingInvoices.length} invoice
                      {outstandingInvoices.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {invoices.length === 0 ? (
                    <p className={styles.profileEmpty}>
                      You don't have any invoices on your account yet.
                    </p>
                  ) : (
                    <ul className={styles.profileItemList}>
                      {invoices.slice(0, 12).map((i) => {
                        const total = i.grand_total ?? i.total;
                        const isPaid =
                          i.paid === true ||
                          (i.payment_status || "").toLowerCase() === "paid";
                        return (
                          <li
                            key={i.invoice_id}
                            className={styles.profileItemRow}
                          >
                            <div>
                              <div className={styles.profileItemTitle}>
                                {i.invoice_number ||
                                  `Invoice ${i.invoice_id?.slice?.(0, 8) || ""}`}
                                {i.job_number ? ` · ${i.job_number}` : ""}
                              </div>
                              <div className={styles.profileItemMeta}>
                                {formatDate(i.created_at)} ·{" "}
                                {formatCurrency(total)}
                                {i.due_date
                                  ? ` · Due ${formatDate(i.due_date)}`
                                  : ""}
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                alignItems: "center",
                              }}
                            >
                              <span
                                className={`${styles.profileBadge} ${
                                  isPaid
                                    ? styles.profileBadgePaid
                                    : styles.profileBadgeOpen
                                }`}
                              >
                                {isPaid ? "Paid" : i.payment_status || "Open"}
                              </span>
                              {!isPaid ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    callAction(
                                      "request_payment_link",
                                      { invoice_id: i.invoice_id },
                                      `pay-${i.invoice_id}`,
                                      "Payment link requested.",
                                    )
                                  }
                                >
                                  Pay
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  callAction(
                                    "request_invoice_pdf",
                                    { invoice_id: i.invoice_id },
                                    `pdf-${i.invoice_id}`,
                                    "PDF requested — we'll email it.",
                                  )
                                }
                              >
                                PDF
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className={styles.profileCard}>
                  <div className={styles.profileCardHeader}>
                    <h2 className={styles.profileCardTitle}>
                      Saved payment methods
                    </h2>
                    <span className={styles.profileCardCount}>
                      {paymentMethods.length}
                    </span>
                  </div>
                  {paymentMethods.length === 0 ? (
                    <p className={styles.profileEmpty}>
                      No saved cards on file.
                    </p>
                  ) : (
                    <ul className={styles.profileItemList}>
                      {paymentMethods.map((p) => (
                        <li key={p.method_id} className={styles.profileCardChip}>
                          <div>
                            <span className={styles.profileCardBrand}>
                              {p.card_brand || "Card"}{" "}
                              {p.is_default ? "· Default" : ""}
                            </span>
                            <div className={styles.profileCardLine}>
                              •••• {p.last4 || "----"} · expires{" "}
                              {String(p.expiry_month || "").padStart(2, "0")}/
                              {String(p.expiry_year || "").slice(-2)}
                            </div>
                            {p.nickname ? (
                              <div className={styles.profileCardLine}>
                                {p.nickname}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              {/* Account statement (transactions) */}
              {(data.transactions?.length || 0) > 0 ? (
                <section className={styles.profileCard}>
                  <div className={styles.profileCardHeader}>
                    <h2 className={styles.profileCardTitle}>
                      Account statement
                    </h2>
                    <span className={styles.profileCardCount}>
                      {data.transactions.length}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      maxHeight: 360,
                      overflowY: "auto",
                    }}
                  >
                    {data.transactions.slice(0, 40).map((t) => {
                      const isCredit =
                        (t.type || "").toLowerCase() === "credit" ||
                        Number(t.amount) < 0;
                      return (
                        <div
                          key={t.transaction_id}
                          className={styles.profileStmtRow}
                        >
                          <span className={styles.profileStmtMeta}>
                            {formatDate(t.transaction_date)}
                          </span>
                          <span>
                            <div>{t.description || t.type}</div>
                            {t.job_number ? (
                              <div className={styles.profileStmtMeta}>
                                {t.job_number}
                                {t.payment_method ? ` · ${t.payment_method}` : ""}
                              </div>
                            ) : null}
                          </span>
                          <span
                            className={
                              isCredit
                                ? styles.profileStmtAmountCredit
                                : styles.profileStmtAmountDebit
                            }
                          >
                            {isCredit ? "−" : ""}
                            {formatCurrency(Math.abs(Number(t.amount)))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {/* ───────── Messages ───────── */}
              <section
                id="messages"
                className={`${styles.profileCard} ${styles.profileCardWide}`}
              >
                <div className={styles.profileCardHeader}>
                  <h2 className={styles.profileCardTitle}>Messages</h2>
                  <span className={styles.profileCardCount}>
                    {messages.length}
                  </span>
                </div>
                <div className={styles.profileThread}>
                  {messages.length === 0 ? (
                    <p className={styles.profileEmpty}>
                      No messages yet — drop us a note below and we'll get
                      back to you.
                    </p>
                  ) : (
                    messages.map((m) => {
                      const isCustomer = m.activity_type === "message_customer";
                      const body =
                        m.activity_payload?.body ||
                        m.activity_payload?.summary ||
                        "(empty)";
                      return (
                        <div
                          key={m.event_id}
                          className={`${styles.profileBubble} ${
                            isCustomer
                              ? styles.profileBubbleCustomer
                              : styles.profileBubbleStaff
                          }`}
                        >
                          {body}
                          <span className={styles.profileBubbleMeta}>
                            {isCustomer ? "You" : "Humphries & Parks"} ·{" "}
                            {formatDateTime(m.occurred_at)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
                <MessageComposer
                  onSend={(body) =>
                    callAction(
                      "send_message",
                      { body },
                      "msg",
                      "Message sent.",
                    )
                  }
                  flash={actionFlash.msg}
                />
              </section>

              {/* ───────── Book a service ───────── */}
              <section id="book" className={styles.profileCard}>
                <div className={styles.profileCardHeader}>
                  <h2 className={styles.profileCardTitle}>Book a service</h2>
                </div>
                <BookServiceForm
                  vehicles={vehicles}
                  onSubmit={(payload) =>
                    callAction(
                      "book_service",
                      payload,
                      "book",
                      "Booking request sent — we'll confirm soon.",
                    )
                  }
                  flash={actionFlash.book}
                />
                {bookingRequests.length > 0 ? (
                  <div style={{ marginTop: 14 }}>
                    <p className={styles.profileSettingsHint}>
                      Recent requests
                    </p>
                    <ul className={styles.profileItemList}>
                      {bookingRequests.slice(0, 5).map((r) => (
                        <li
                          key={r.request_id}
                          className={styles.profileItemRow}
                        >
                          <div>
                            <div className={styles.profileItemTitle}>
                              {r.description || "Booking request"}
                            </div>
                            <div className={styles.profileItemMeta}>
                              {formatDate(r.submitted_at)}
                              {r.estimated_completion
                                ? ` · ETA ${formatDate(r.estimated_completion)}`
                                : ""}
                            </div>
                          </div>
                          <span className={styles.profileBadge}>
                            {r.status || "Pending"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              {/* ───────── Our services (body / SMART / valet / parts etc) ───────── */}
              <section
                id="services"
                className={`${styles.profileCard} ${styles.profileCardWide}`}
              >
                <div className={styles.profileCardHeader}>
                  <h2 className={styles.profileCardTitle}>Our services</h2>
                </div>
                <p className={styles.profileSettingsHint}>
                  Anything we do — pick what you need and we'll come back to
                  you with a quote or callback.
                </p>
                <ServiceQuoteRow
                  vehicles={vehicles}
                  onSubmit={(action, payload, label) =>
                    callAction(action, payload, "svcq", `${label} request sent.`)
                  }
                  flash={actionFlash.svcq}
                />
              </section>

              {/* ───────── Sell your car ───────── */}
              <section id="sell" className={styles.profileCard}>
                <div className={styles.profileCardHeader}>
                  <h2 className={styles.profileCardTitle}>Sell your car</h2>
                </div>
                <p className={styles.profileSettingsHint}>
                  Any age, any mileage, any make or model. Free valuation,
                  no obligation.
                </p>
                <SellCarForm
                  onSubmit={(payload) =>
                    callAction(
                      "request_valuation",
                      payload,
                      "sell",
                      "Valuation request sent.",
                    )
                  }
                  flash={actionFlash.sell}
                />
              </section>

              {/* ───────── Showroom / callback ───────── */}
              <section id="showroom" className={styles.profileCard}>
                <div className={styles.profileCardHeader}>
                  <h2 className={styles.profileCardTitle}>Showroom</h2>
                </div>
                <p className={styles.profileSettingsHint}>
                  See something you like? Tell us which car and we'll arrange
                  a callback or test drive.
                </p>
                <ShowroomCallbackForm
                  onSubmit={(payload) =>
                    callAction(
                      "request_vehicle_callback",
                      payload,
                      "show",
                      "Callback request sent.",
                    )
                  }
                  flash={actionFlash.show}
                />
                <div style={{ marginTop: 12 }}>
                  <Link
                    href="/website#cars"
                    className={`app-btn ${styles.profileGhostBtn}`}
                  >
                    Browse all cars
                  </Link>
                </div>
              </section>

              {/* ───────── Activity timeline ───────── */}
              <section id="activity" className={styles.profileCard}>
                <div className={styles.profileCardHeader}>
                  <h2 className={styles.profileCardTitle}>Activity</h2>
                  <span className={styles.profileCardCount}>
                    {timeline.length}
                  </span>
                </div>
                {timeline.length === 0 ? (
                  <p className={styles.profileEmpty}>
                    Once you've booked in or had work done, your activity will
                    appear here.
                  </p>
                ) : (
                  <div className={styles.profileTimeline}>
                    {timeline.slice(0, 30).map((event) => (
                      <div
                        key={event.event_id}
                        className={styles.profileTimelineRow}
                      >
                        <span className={styles.profileTimelineWhen}>
                          {formatDate(event.occurred_at)}
                        </span>
                        <span className={styles.profileTimelineWhat}>
                          {humaniseActivity(event)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ───────── Settings / security ───────── */}
              <section
                id="settings"
                className={`${styles.profileCard} ${styles.profileCardWide}`}
              >
                <div className={styles.profileCardHeader}>
                  <h2 className={styles.profileCardTitle}>
                    Account & security
                  </h2>
                </div>
                <div className={styles.profileSettingsList}>
                  <ChangePasswordRow
                    onSuccess={() => flash("pw", "Password updated.")}
                    flash={actionFlash.pw}
                  />
                  <ChangeEmailRow
                    currentEmail={customer.email}
                    onSuccess={() => {
                      flash("email", "Email updated.");
                      refresh();
                    }}
                    flash={actionFlash.email}
                  />
                  <NotificationPrefsRow
                    initial={customer}
                    onSuccess={() => flash("prefs", "Preferences saved.")}
                    flash={actionFlash.prefs}
                  />
                  <ReferralRow
                    onSubmit={(payload) =>
                      callAction(
                        "refer_friend",
                        payload,
                        "ref",
                        "Thanks — we'll be in touch with your friend.",
                      )
                    }
                    flash={actionFlash.ref}
                  />
                  <DataActionsRow
                    onExport={() =>
                      callAction(
                        "request_data_export",
                        {},
                        "exp",
                        "Data export requested — we'll email it.",
                      )
                    }
                    onDelete={() =>
                      callAction(
                        "request_account_deletion",
                        {},
                        "del",
                        "Deletion request submitted.",
                      )
                    }
                    flashExp={actionFlash.exp}
                    flashDel={actionFlash.del}
                  />
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}

function DetailField({ label, value }) {
  return (
    <div className={styles.profileDetailField}>
      <span className={styles.profileDetailLabel}>{label}</span>
      <span className={styles.profileDetailValue}>{value || "—"}</span>
    </div>
  );
}

function FieldInput({ label, value, onChange, type = "text" }) {
  return (
    <div className={styles.authField}>
      <label className={styles.authLabel}>{label}</label>
      <input
        type={type}
        className={styles.authInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function MessageComposer({ onSend, flash }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <>
      <div className={styles.profileComposer}>
        <textarea
          className={styles.profileComposerInput}
          placeholder="Type a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="button"
          className={`app-btn ${styles.authSubmit}`}
          disabled={sending || !body.trim()}
          onClick={async () => {
            setSending(true);
            await onSend(body.trim());
            setBody("");
            setSending(false);
          }}
        >
          Send
        </button>
      </div>
      {flash ? <p className={styles.profileSuccess}>{flash}</p> : null}
    </>
  );
}

function BookServiceForm({ vehicles, onSubmit, flash }) {
  const [vehicleId, setVehicleId] = useState("");
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className={styles.authForm}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!description.trim()) return;
        setSubmitting(true);
        await onSubmit({
          vehicle_id: vehicleId || null,
          description: description.trim(),
          preferred_date: preferredDate || null,
        });
        setDescription("");
        setPreferredDate("");
        setSubmitting(false);
      }}
    >
      <div className={styles.authRow}>
        <div className={styles.authField}>
          <label className={styles.authLabel}>Vehicle</label>
          <WebsiteSelect
            value={vehicleId}
            onChange={setVehicleId}
            placeholder="Select…"
            options={vehicles.map((v) => ({
              value: String(v.vehicle_id),
              label: `${v.reg_number || "—"} · ${[v.make, v.model].filter(Boolean).join(" ")}`,
            }))}
          />
        </div>
        <div className={styles.authField}>
          <label className={styles.authLabel}>Preferred date</label>
          <WebsiteDatePicker
            value={preferredDate}
            onChange={setPreferredDate}
            placeholder="Pick a date"
          />
        </div>
      </div>
      <div className={styles.authField}>
        <label className={styles.authLabel}>What do you need?</label>
        <textarea
          className={styles.authInput}
          rows={3}
          placeholder="e.g. annual service + brake check"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <button
        type="submit"
        className={`app-btn ${styles.authSubmit}`}
        disabled={submitting || !description.trim()}
      >
        {submitting ? "Sending…" : "Request booking"}
      </button>
      {flash ? <p className={styles.profileSuccess}>{flash}</p> : null}
    </form>
  );
}

function ChangePasswordRow({ onSuccess, flash }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className={styles.profileSettingsRow}>
      <div className={styles.profileSettingsRowHeader}>
        <div>
          <div className={styles.profileSettingsTitle}>Password</div>
          <div className={styles.profileSettingsHint}>
            Change the password you use to sign in here.
          </div>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Change"}
        </button>
      </div>
      {open ? (
        <form
          className={styles.authForm}
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setSaving(true);
            try {
              const res = await fetch("/api/website/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                  currentPassword: current,
                  newPassword: next,
                }),
              });
              const data = await res.json();
              if (!res.ok || !data.success) {
                throw new Error(data.message || "Could not update password.");
              }
              setCurrent("");
              setNext("");
              setOpen(false);
              onSuccess();
            } catch (err) {
              setError(err.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {error ? <p className={styles.authError}>{error}</p> : null}
          <FieldInput
            label="Current password"
            type="password"
            value={current}
            onChange={setCurrent}
          />
          <FieldInput
            label="New password (min. 12 characters)"
            type="password"
            value={next}
            onChange={setNext}
          />
          <button
            type="submit"
            className={`app-btn ${styles.authSubmit}`}
            disabled={saving}
          >
            {saving ? "Saving…" : "Update password"}
          </button>
        </form>
      ) : null}
      {flash ? <p className={styles.profileSuccess}>{flash}</p> : null}
    </div>
  );
}

function ChangeEmailRow({ currentEmail, onSuccess, flash }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className={styles.profileSettingsRow}>
      <div className={styles.profileSettingsRowHeader}>
        <div>
          <div className={styles.profileSettingsTitle}>Email</div>
          <div className={styles.profileSettingsHint}>
            {currentEmail || "—"}
          </div>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Change"}
        </button>
      </div>
      {open ? (
        <form
          className={styles.authForm}
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setSaving(true);
            try {
              const res = await fetch("/api/website/auth/change-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                  currentPassword: pw,
                  newEmail: next,
                }),
              });
              const data = await res.json();
              if (!res.ok || !data.success) {
                throw new Error(data.message || "Could not change email.");
              }
              setPw("");
              setNext("");
              setOpen(false);
              onSuccess();
            } catch (err) {
              setError(err.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {error ? <p className={styles.authError}>{error}</p> : null}
          <FieldInput
            label="New email"
            type="email"
            value={next}
            onChange={setNext}
          />
          <FieldInput
            label="Current password"
            type="password"
            value={pw}
            onChange={setPw}
          />
          <button
            type="submit"
            className={`app-btn ${styles.authSubmit}`}
            disabled={saving}
          >
            {saving ? "Saving…" : "Update email"}
          </button>
        </form>
      ) : null}
      {flash ? <p className={styles.profileSuccess}>{flash}</p> : null}
    </div>
  );
}

function NotificationPrefsRow({ initial, onSuccess, flash }) {
  const [channel, setChannel] = useState(initial.contact_preference || "email");
  const [marketingEmail, setMarketingEmail] = useState(false);
  const [marketingSms, setMarketingSms] = useState(false);
  const [serviceReminders, setServiceReminders] = useState(true);
  const [motReminders, setMotReminders] = useState(true);
  const [saving, setSaving] = useState(false);
  return (
    <div className={styles.profileSettingsRow}>
      <div className={styles.profileSettingsRowHeader}>
        <div>
          <div className={styles.profileSettingsTitle}>Notifications</div>
          <div className={styles.profileSettingsHint}>
            How and when we contact you.
          </div>
        </div>
      </div>
      <div className={styles.authField}>
        <label className={styles.authLabel}>Preferred channel</label>
        <WebsiteSelect
          value={channel}
          onChange={setChannel}
          options={[
            { value: "email", label: "Email" },
            { value: "phone", label: "Phone" },
            { value: "sms", label: "SMS" },
            { value: "post", label: "Post" },
          ]}
        />
      </div>
      <Toggle
        label="MOT reminders"
        checked={motReminders}
        onChange={setMotReminders}
      />
      <Toggle
        label="Service reminders"
        checked={serviceReminders}
        onChange={setServiceReminders}
      />
      <Toggle
        label="Marketing email (offers, news)"
        checked={marketingEmail}
        onChange={setMarketingEmail}
      />
      <Toggle
        label="Marketing SMS"
        checked={marketingSms}
        onChange={setMarketingSms}
      />
      <button
        type="button"
        className={`app-btn ${styles.authSubmit}`}
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            const res = await fetch("/api/website/auth/notification-prefs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({
                contact_preference: channel,
                optIns: {
                  marketingEmail,
                  marketingSms,
                  serviceReminders,
                  motReminders,
                },
              }),
            });
            const data = await res.json();
            if (res.ok && data.success) onSuccess();
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : "Save preferences"}
      </button>
      {flash ? <p className={styles.profileSuccess}>{flash}</p> : null}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className={styles.profileToggleRow}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function DataActionsRow({ onExport, onDelete, flashExp, flashDel }) {
  return (
    <div className={styles.profileSettingsRow}>
      <div className={styles.profileSettingsRowHeader}>
        <div>
          <div className={styles.profileSettingsTitle}>Your data</div>
          <div className={styles.profileSettingsHint}>
            Request a copy of everything we hold, or ask us to remove your
            account.
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={onExport}>
          Request data export
        </button>
        <button
          type="button"
          className={styles.profileDanger}
          onClick={() => {
            if (
              window.confirm(
                "Send an account deletion request? Our team will be in touch to confirm before anything is removed.",
              )
            ) {
              onDelete();
            }
          }}
        >
          Request account deletion
        </button>
      </div>
      {flashExp ? <p className={styles.profileSuccess}>{flashExp}</p> : null}
      {flashDel ? <p className={styles.profileSuccess}>{flashDel}</p> : null}
    </div>
  );
}

function ActiveJobTags({ job, bookingRequest, vhcSent }) {
  if (!job) return null;
  const tags = [];
  if ((job.service_mode || "").toLowerCase() === "mobile") {
    tags.push({
      key: "mobile",
      label: `Mobile visit${job.service_postcode ? ` · ${job.service_postcode}` : ""}`,
      tone: "accent",
    });
  }
  if (bookingRequest?.estimated_completion) {
    tags.push({
      key: "eta",
      label: `ETA ${formatDate(bookingRequest.estimated_completion)}`,
      tone: "default",
    });
  }
  if (bookingRequest?.loan_car_details) {
    tags.push({
      key: "loan",
      label: `Courtesy car · ${bookingRequest.loan_car_details}`,
      tone: "ok",
    });
  }
  if (Number(job.vhc_authorized_total) > 0) {
    tags.push({
      key: "vhc-auth",
      label: `Authorised ${formatCurrency(job.vhc_authorized_total)}`,
      tone: "ok",
    });
  }
  if (Number(job.vhc_declined_total) > 0) {
    tags.push({
      key: "vhc-dec",
      label: `Declined ${formatCurrency(job.vhc_declined_total)}`,
      tone: "default",
    });
  }
  if (vhcSent?.sent_at) {
    tags.push({
      key: "vhc-sent",
      label: `Report sent ${formatDate(vhcSent.sent_at)}`,
      tone: "default",
    });
  }
  if (tags.length === 0) return null;
  return (
    <div className={styles.profileTagRow}>
      {tags.map((t) => (
        <span
          key={t.key}
          className={`${styles.profileTag} ${
            t.tone === "accent"
              ? styles.profileTagAccent
              : t.tone === "ok"
              ? styles.profileTagOk
              : ""
          }`}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function UpdateMileageRow({ vehicles, onSaved, flash }) {
  const [vehicleId, setVehicleId] = useState("");
  const [mileage, setMileage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className={styles.profileSettingsRow}>
      <div className={styles.profileSettingsRowHeader}>
        <div>
          <div className={styles.profileSettingsTitle}>Update mileage</div>
          <div className={styles.profileSettingsHint}>
            Help us flag the next service at the right time.
          </div>
        </div>
      </div>
      {error ? <p className={styles.authError}>{error}</p> : null}
      <div className={styles.authRow}>
        <div className={styles.authField}>
          <label className={styles.authLabel}>Vehicle</label>
          <WebsiteSelect
            value={vehicleId}
            onChange={setVehicleId}
            placeholder="Select…"
            options={vehicles.map((v) => ({
              value: String(v.vehicle_id),
              label: `${v.reg_number || "—"} · ${[v.make, v.model].filter(Boolean).join(" ")}`,
            }))}
          />
        </div>
        <div className={styles.authField}>
          <label className={styles.authLabel}>Current mileage</label>
          <input
            type="number"
            inputMode="numeric"
            className={styles.authInput}
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="e.g. 48250"
          />
        </div>
      </div>
      <button
        type="button"
        className={`app-btn ${styles.authSubmit}`}
        disabled={saving || !vehicleId || !mileage}
        onClick={async () => {
          setError("");
          setSaving(true);
          try {
            const res = await fetch(
              "/api/website/actions/update-mileage",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                  vehicle_id: Number(vehicleId),
                  mileage: Number(mileage),
                }),
              },
            );
            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data.message || "Could not update mileage.");
            }
            setMileage("");
            onSaved();
          } catch (err) {
            setError(err.message);
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : "Save mileage"}
      </button>
      {flash ? <p className={styles.profileSuccess}>{flash}</p> : null}
    </div>
  );
}

function AddVehicleRow({ onSubmit, flash }) {
  const [reg, setReg] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [mileage, setMileage] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className={styles.profileSettingsRow}>
      <div className={styles.profileSettingsRowHeader}>
        <div>
          <div className={styles.profileSettingsTitle}>Add a vehicle</div>
          <div className={styles.profileSettingsHint}>
            We'll add this to your account and check our records.
          </div>
        </div>
      </div>
      <div className={styles.authRow}>
        <FieldInput label="Registration" value={reg} onChange={setReg} />
        <FieldInput
          label="Make & model"
          value={makeModel}
          onChange={setMakeModel}
        />
      </div>
      <div className={styles.authRow}>
        <FieldInput
          label="Mileage (optional)"
          value={mileage}
          onChange={setMileage}
          type="number"
        />
        <FieldInput label="Notes (optional)" value={notes} onChange={setNotes} />
      </div>
      <button
        type="button"
        className={`app-btn ${styles.authSubmit}`}
        disabled={submitting || !reg.trim()}
        onClick={async () => {
          setSubmitting(true);
          await onSubmit({
            reg: reg.trim(),
            make_model: makeModel.trim(),
            mileage: mileage ? Number(mileage) : null,
            notes: notes.trim(),
          });
          setReg("");
          setMakeModel("");
          setMileage("");
          setNotes("");
          setSubmitting(false);
        }}
      >
        {submitting ? "Sending…" : "Request to add"}
      </button>
      {flash ? <p className={styles.profileSuccess}>{flash}</p> : null}
    </div>
  );
}

function ServiceQuoteRow({ vehicles, onSubmit, flash }) {
  const [picked, setPicked] = useState(SERVICE_TYPES[0]);
  const [vehicleId, setVehicleId] = useState("");
  const [details, setDetails] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <>
      <div className={styles.profileServiceGrid}>
        {SERVICE_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.profileServiceTile} ${
              picked.id === t.id ? styles.profileServiceTileActive : ""
            }`}
            onClick={() => setPicked(t)}
          >
            <span className={styles.profileServiceTileTitle}>{t.title}</span>
            <span className={styles.profileServiceTileHint}>{t.hint}</span>
          </button>
        ))}
      </div>
      <form
        className={styles.authForm}
        style={{ marginTop: 14 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!details.trim()) return;
          setSubmitting(true);
          await onSubmit(
            picked.action,
            {
              service_type: picked.id,
              vehicle_id: vehicleId || null,
              description: details.trim(),
              preferred_date: preferredDate || null,
            },
            picked.title,
          );
          setDetails("");
          setPreferredDate("");
          setSubmitting(false);
        }}
      >
        <div className={styles.authRow}>
          <div className={styles.authField}>
            <label className={styles.authLabel}>Vehicle (optional)</label>
            <WebsiteSelect
              value={vehicleId}
              onChange={setVehicleId}
              placeholder="Not specific to a vehicle"
              options={vehicles.map((v) => ({
                value: String(v.vehicle_id),
                label: `${v.reg_number || "—"} · ${[v.make, v.model].filter(Boolean).join(" ")}`,
              }))}
            />
          </div>
          <div className={styles.authField}>
            <label className={styles.authLabel}>Preferred date</label>
            <WebsiteDatePicker
              value={preferredDate}
              onChange={setPreferredDate}
            />
          </div>
        </div>
        <div className={styles.authField}>
          <label className={styles.authLabel}>Tell us a bit more</label>
          <textarea
            className={styles.authInput}
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={`e.g. ${picked.hint.toLowerCase()}`}
          />
        </div>
        <button
          type="submit"
          className={`app-btn ${styles.authSubmit}`}
          disabled={submitting || !details.trim()}
        >
          {submitting ? "Sending…" : `Request ${picked.title.toLowerCase()}`}
        </button>
        {flash ? <p className={styles.profileSuccess}>{flash}</p> : null}
      </form>
    </>
  );
}

function SellCarForm({ onSubmit, flash }) {
  const [reg, setReg] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [mileage, setMileage] = useState("");
  const [condition, setCondition] = useState("Excellent");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className={styles.authForm}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!reg.trim()) return;
        setSubmitting(true);
        await onSubmit({
          reg: reg.trim(),
          make_model: makeModel.trim(),
          mileage: mileage ? Number(mileage) : null,
          condition,
          notes: notes.trim(),
        });
        setReg("");
        setMakeModel("");
        setMileage("");
        setNotes("");
        setSubmitting(false);
      }}
    >
      <div className={styles.authRow}>
        <FieldInput label="Registration" value={reg} onChange={setReg} />
        <FieldInput
          label="Make & model"
          value={makeModel}
          onChange={setMakeModel}
        />
      </div>
      <div className={styles.authRow}>
        <FieldInput
          label="Mileage"
          value={mileage}
          onChange={setMileage}
          type="number"
        />
        <div className={styles.authField}>
          <label className={styles.authLabel}>Condition</label>
          <WebsiteSelect
            value={condition}
            onChange={setCondition}
            options={[
              { value: "Excellent", label: "Excellent" },
              { value: "Good", label: "Good" },
              { value: "Average", label: "Average" },
              { value: "Below average", label: "Below average" },
            ]}
          />
        </div>
      </div>
      <div className={styles.authField}>
        <label className={styles.authLabel}>Notes (optional)</label>
        <textarea
          className={styles.authInput}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Service history, modifications, anything else we should know."
        />
      </div>
      <button
        type="submit"
        className={`app-btn ${styles.authSubmit}`}
        disabled={submitting || !reg.trim()}
      >
        {submitting ? "Sending…" : "Get free valuation"}
      </button>
      {flash ? <p className={styles.profileSuccess}>{flash}</p> : null}
    </form>
  );
}

function ShowroomCallbackForm({ onSubmit, flash }) {
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className={styles.authForm}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!interest.trim()) return;
        setSubmitting(true);
        await onSubmit({
          vehicle_interest: interest.trim(),
          notes: notes.trim(),
          callback_date: callbackDate || null,
        });
        setInterest("");
        setNotes("");
        setCallbackDate("");
        setSubmitting(false);
      }}
    >
      <FieldInput
        label="Which vehicle?"
        value={interest}
        onChange={setInterest}
      />
      <div className={styles.authRow}>
        <div className={styles.authField}>
          <label className={styles.authLabel}>Preferred callback</label>
          <WebsiteDatePicker
            value={callbackDate}
            onChange={setCallbackDate}
          />
        </div>
        <FieldInput label="Notes" value={notes} onChange={setNotes} />
      </div>
      <button
        type="submit"
        className={`app-btn ${styles.authSubmit}`}
        disabled={submitting || !interest.trim()}
      >
        {submitting ? "Sending…" : "Request callback"}
      </button>
      {flash ? <p className={styles.profileSuccess}>{flash}</p> : null}
    </form>
  );
}

function ReferralRow({ onSubmit, flash }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className={styles.profileSettingsRow}>
      <div className={styles.profileSettingsRowHeader}>
        <div>
          <div className={styles.profileSettingsTitle}>Refer a friend</div>
          <div className={styles.profileSettingsHint}>
            Send us a friend who needs us — we'll take it from there.
          </div>
        </div>
      </div>
      <div className={styles.authRow}>
        <FieldInput label="Their name" value={name} onChange={setName} />
        <FieldInput
          label="Their email"
          value={email}
          onChange={setEmail}
          type="email"
        />
      </div>
      <FieldInput label="Their phone (optional)" value={phone} onChange={setPhone} />
      <button
        type="button"
        className={`app-btn ${styles.authSubmit}`}
        disabled={submitting || !name.trim() || !email.trim()}
        onClick={async () => {
          setSubmitting(true);
          await onSubmit({
            referred_name: name.trim(),
            referred_email: email.trim(),
            referred_phone: phone.trim(),
          });
          setName("");
          setEmail("");
          setPhone("");
          setSubmitting(false);
        }}
      >
        {submitting ? "Sending…" : "Send referral"}
      </button>
      {flash ? <p className={styles.profileSuccess}>{flash}</p> : null}
    </div>
  );
}

CustomerProfilePage.getLayout = (page) => page;
