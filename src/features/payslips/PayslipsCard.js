// file location: src/features/payslips/PayslipsCard.js
// Profile Work tab card showing the last 4 payslips. Reuses the personal
// passcode (PIN) flow from /api/personal/security via usePersonalLock — there
// is no second PIN system. While locked the card renders placeholder rows
// and a "tap to unlock" hint; clicking anything opens the existing PIN modal.
// Once unlocked, clicking the card opens the list popup and clicking a row
// opens the detailed payslip popup.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import Button from "@/components/ui/Button";
import PersonalPasscodeModal from "@/components/profile/PersonalPasscodeModal";
import usePersonalLock from "@/hooks/usePersonalLock";
import {
  buildPayslipsSummary,
  formatCurrency,
  formatDate,
  formatPeriodLabel,
  formatStatusLabel,
  getStatusTone,
} from "./payslipUtils";
import PayslipsListPopup from "./PayslipsListPopup";
import PayslipDetailPopup from "./PayslipDetailPopup";

const cardSurfaceStyle = {
  background: "var(--profile-card-bg, var(--surface))",
  borderRadius: "var(--radius-md, 12px)",
  border: "var(--profile-card-border, 1px solid rgba(var(--accent-purple-rgb), 0.28))",
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 0,
  overflow: "hidden",
  minHeight: "112px",
};

function PayslipRow({ kind, payslip, onClick }) {
  const isPayslip = kind === "payslip" && payslip;
  const isLocked = kind === "locked";
  const tone = isPayslip ? getStatusTone(payslip.status) : { bg: "transparent", color: "transparent" };

  const rowStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) auto auto",
    gap: "10px",
    alignItems: "center",
    padding: "8px 12px",
    borderTop: "1px solid rgba(var(--text-primary-rgb), 0.06)",
    background: "transparent",
    color: "var(--text-primary)",
    textAlign: "left",
    width: "100%",
    minHeight: "44px",
    filter: isLocked ? "blur(3px)" : "none",
  };

  // Empty rows are intentionally blank — non-interactive, no dates, no
  // placeholder dashes. They keep the card's visual rhythm before any
  // payslip records exist for the user.
  if (kind === "empty") {
    return <div aria-hidden="true" style={{ ...rowStyle, cursor: "default" }} />;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...rowStyle, cursor: "pointer" }}
      aria-label={
        isLocked
          ? "Locked payslip — click to unlock"
          : `Open payslip from ${formatDate(payslip.paidDate)}`
      }
    >
      <div style={{ display: "grid", gap: "2px", minWidth: 0 }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
          {isPayslip ? formatDate(payslip.paidDate) : "—"}
        </span>
        <span
          style={{
            fontSize: "0.72rem",
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {isPayslip ? formatPeriodLabel(payslip) : "Locked"}
        </span>
      </div>
      <span style={{ fontWeight: 700, color: "var(--accentText, var(--accent))", fontSize: "0.92rem" }}>
        {isPayslip ? formatCurrency(payslip.netPay) : "£•••"}
      </span>
      <span
        style={{
          padding: "2px 8px",
          borderRadius: "999px",
          background: tone.bg,
          color: tone.color,
          fontSize: "0.66rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          visibility: isPayslip ? "visible" : "hidden",
        }}
      >
        {isPayslip ? formatStatusLabel(payslip.status) : "—"}
      </span>
    </button>
  );
}

export default function PayslipsCard({
  sectionKey,
  parentKey,
  profile = null,
  enabled = true,
}) {
  const lock = usePersonalLock({ enabled });

  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [isPasscodeOpen, setIsPasscodeOpen] = useState(false);
  const [passcodeError, setPasscodeError] = useState("");
  const [passcodeSubmitting, setPasscodeSubmitting] = useState(false);
  const [pendingOpenList, setPendingOpenList] = useState(false);

  const [isListOpen, setIsListOpen] = useState(false);
  const [activePayslip, setActivePayslip] = useState(null);

  // Depend only on the primitive flag and the stable refresh callback —
  // depending on the whole `lock` object retriggered the fetch every render
  // because usePersonalLock returns a fresh object each time, which spun the
  // card in an infinite "Loading payslips…" loop.
  const lockRefresh = lock.refresh;
  const isUnlocked = lock.isUnlocked;

  const fetchPayslips = useCallback(async () => {
    if (!isUnlocked) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/payslips", { credentials: "include" });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.success === false) {
        if (response.status === 423) {
          await lockRefresh();
          return;
        }
        throw new Error(json?.message || `Request failed with status ${response.status}`);
      }
      setPayslips(Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [isUnlocked, lockRefresh]);

  useEffect(() => {
    if (isUnlocked) {
      fetchPayslips();
    } else {
      setPayslips([]);
    }
  }, [isUnlocked, fetchPayslips]);

  // After a successful unlock that was triggered from the card, open the list popup.
  useEffect(() => {
    if (lock.isUnlocked && pendingOpenList) {
      setPendingOpenList(false);
      setIsListOpen(true);
    }
  }, [lock.isUnlocked, pendingOpenList]);

  const passcodeMode = lock.isSetup ? "unlock" : "setup";

  const handleOpen = useCallback(() => {
    if (lock.isLoading) return;
    if (lock.isUnlocked) {
      setIsListOpen(true);
      return;
    }
    setPendingOpenList(true);
    setPasscodeError("");
    setIsPasscodeOpen(true);
  }, [lock.isLoading, lock.isUnlocked]);

  const handlePasscodeSubmit = async ({ passcode, confirmPasscode }) => {
    setPasscodeSubmitting(true);
    setPasscodeError("");
    try {
      if (String(passcode || "").length !== 4) {
        throw new Error(passcodeMode === "setup" ? "Enter a 4-digit passcode." : "Enter your 4-digit code.");
      }
      if (passcodeMode === "setup" && String(confirmPasscode || "").length !== 4) {
        throw new Error("Confirm your 4-digit passcode.");
      }
      if (passcodeMode === "setup") {
        await lock.setupPasscode({ passcode, confirmPasscode });
      } else {
        await lock.unlock({ passcode });
      }
      setIsPasscodeOpen(false);
    } catch (err) {
      const message =
        err?.statusCode === 401
          ? "That code is incorrect. Please try again."
          : err?.message || "Unable to unlock payslips.";
      setPasscodeError(message);
    } finally {
      setPasscodeSubmitting(false);
    }
  };

  const summary = useMemo(() => buildPayslipsSummary(payslips, profile), [payslips, profile]);

  // Card always renders exactly 2 rows so the layout matches the other KPI
  // tiles. When locked, both rows are blurred placeholders. When unlocked but
  // empty, both rows are intentionally blank — we don't show fake dates.
  const VISIBLE_ROWS = 2;
  const visibleRows = useMemo(() => {
    if (!isUnlocked) {
      return Array.from({ length: VISIBLE_ROWS }, (_, idx) => ({ kind: "locked", idx }));
    }
    const slips = payslips.slice(0, VISIBLE_ROWS);
    const padded = [...slips];
    while (padded.length < VISIBLE_ROWS) padded.push({ kind: "empty", idx: padded.length });
    return padded.map((entry) =>
      entry?.kind === "empty" ? entry : { kind: "payslip", payslip: entry }
    );
  }, [isUnlocked, payslips]);

  return (
    <>
      <DevLayoutSection
        as="div"
        sectionKey={sectionKey}
        parentKey={parentKey}
        sectionType="content-card"
        backgroundToken="accent-surface"
        className="app-profile-accent-card"
        style={cardSurfaceStyle}
      >
        {/* Header */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleOpen}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleOpen();
            }
          }}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
            padding: "10px 14px 6px",
            cursor: "pointer",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
            Payslips
          </div>
          <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
            {isUnlocked ? "View all" : "Locked"}
          </span>
        </div>

        {/* Body — last 2 payslip rows, blurred when locked, blank when empty */}
        <div style={{ flex: 1, position: "relative" }}>
          {visibleRows.map((row, idx) => (
            <PayslipRow
              key={row.kind === "payslip" ? row.payslip.id : `${row.kind}-${idx}`}
              kind={row.kind}
              payslip={row.kind === "payslip" ? row.payslip : null}
              onClick={() => {
                if (row.kind === "locked") {
                  handleOpen();
                  return;
                }
                if (row.kind === "payslip") {
                  setActivePayslip(row.payslip);
                }
              }}
            />
          ))}

          {!isUnlocked ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(var(--surface-rgb, 255,255,255), 0.55)",
                backdropFilter: "blur(2px)",
                pointerEvents: "none",
              }}
            >
              <div style={{ pointerEvents: "auto" }}>
                <Button type="button" variant="primary" size="sm" pill onClick={handleOpen}>
                  {lock.isSetup ? "Unlock payslips" : "Set up passcode"}
                </Button>
              </div>
            </div>
          ) : null}

          {loading && isUnlocked && payslips.length === 0 ? (
            <div
              style={{
                padding: "6px 14px",
                fontSize: "0.72rem",
                color: "var(--text-secondary)",
              }}
            >
              Loading…
            </div>
          ) : null}

          {error && isUnlocked ? (
            <div
              style={{
                padding: "6px 14px",
                fontSize: "0.74rem",
                color: "var(--danger, #c62828)",
              }}
            >
              {error.message || "Unable to load payslips."}
            </div>
          ) : null}
        </div>
      </DevLayoutSection>

      <PersonalPasscodeModal
        isOpen={isPasscodeOpen}
        mode={passcodeMode}
        isSubmitting={passcodeSubmitting}
        error={passcodeError}
        unlockTitle="Unlock payslips"
        unlockHint="Enter your 4-digit personal passcode to view payslips."
        setupTitle="Create your personal passcode"
        setupHint="Set a 4-digit passcode — it also unlocks the personal tab."
        onClose={() => {
          setIsPasscodeOpen(false);
          setPasscodeError("");
          setPendingOpenList(false);
        }}
        onSubmit={handlePasscodeSubmit}
      />

      <PayslipsListPopup
        isOpen={isListOpen && isUnlocked}
        onClose={() => setIsListOpen(false)}
        payslips={payslips}
        loading={loading}
        error={error}
        summary={summary}
        onSelectPayslip={(slip) => setActivePayslip(slip)}
      />

      <PayslipDetailPopup
        isOpen={Boolean(activePayslip)}
        payslip={activePayslip}
        onClose={() => setActivePayslip(null)}
      />
    </>
  );
}
