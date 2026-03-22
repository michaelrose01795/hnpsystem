import React, { useEffect, useMemo, useState } from "react";
import usePersonalDashboard from "@/hooks/usePersonalDashboard";
import PasscodeModal from "@/components/profile/personal/PasscodeModal";
import PersonalDashboard from "@/components/profile/personal/PersonalDashboard";

export default function ProfilePersonalTab({ disabled = false, onHeaderActionsChange = null }) {
  const dashboard = usePersonalDashboard({ enabled: !disabled });
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!disabled && !dashboard.isInitialising && !dashboard.isUnlocked && !dashboard.isSetup) {
      setIsPasscodeModalOpen(true);
    }
    if (dashboard.isUnlocked) {
      setIsPasscodeModalOpen(false);
      setModalError("");
    }
  }, [dashboard.isInitialising, dashboard.isUnlocked, dashboard.isSetup, disabled]);

  const headerActions = useMemo(() => {
    if (!dashboard.isUnlocked) {
      return null;
    }

    return (
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => setIsAddWidgetOpen(true)}
          style={{
            borderRadius: "999px",
            border: "none",
            background: "var(--accent-purple)",
            color: "#ffffff",
            padding: "10px 14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Add widget
        </button>
        <button
          type="button"
          onClick={dashboard.lock}
          style={{
            borderRadius: "999px",
            border: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
            background: "transparent",
            color: "var(--text-primary)",
            padding: "10px 14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Lock
        </button>
      </div>
    );
  }, [dashboard.isUnlocked, dashboard.lock]);

  useEffect(() => {
    onHeaderActionsChange?.(headerActions);
    return () => onHeaderActionsChange?.(null);
  }, [headerActions, onHeaderActionsChange]);

  if (disabled) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid rgba(var(--accent-purple-rgb), 0.24)",
          borderRadius: "var(--radius-md)",
          padding: "24px",
          color: "var(--text-primary)",
        }}
      >
        Personal dashboard access is only available when you are viewing your own profile.
      </div>
    );
  }

  const passcodeMode = dashboard.isSetup ? "unlock" : "setup";

  const handlePasscodeSubmit = async ({ passcode, confirmPasscode }) => {
    setIsSubmitting(true);
    setModalError("");
    try {
      if (passcodeMode === "setup") {
        await dashboard.setupPasscode({ passcode, confirmPasscode });
      } else {
        await dashboard.unlock({ passcode });
      }
    } catch (error) {
      setModalError(error.message || "Unable to unlock personal dashboard.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {dashboard.isUnlocked ? (
        <PersonalDashboard
          dashboard={{
            ...dashboard,
            isAddWidgetOpen,
            onCloseAddWidget: () => setIsAddWidgetOpen(false),
          }}
        />
      ) : (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(var(--accent-purple-rgb), 0.24)",
            borderRadius: "20px",
            padding: "24px",
            display: "grid",
            gap: "12px",
          }}
        >
          <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>Personal dashboard locked</div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setIsPasscodeModalOpen(true)}
              style={{
                borderRadius: "999px",
                border: "none",
                background: "var(--accent-purple)",
                color: "#ffffff",
                padding: "10px 14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {dashboard.isSetup ? "Unlock" : "Set up passcode"}
            </button>
            {dashboard.isSetup ? (
              <button
                type="button"
                onClick={async () => {
                  setModalError("");
                  try {
                    await dashboard.resetPasscode();
                    setIsPasscodeModalOpen(true);
                  } catch (error) {
                    setModalError(error.message || "Unable to reset code.");
                  }
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: "0.78rem",
                  textDecoration: "underline",
                  padding: "10px 6px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Reset code
              </button>
            ) : null}
          </div>
          {dashboard.error ? (
            <div
              style={{
                borderRadius: "14px",
                padding: "10px 12px",
                background: "rgba(198, 40, 40, 0.08)",
                color: "var(--danger, #c62828)",
                fontSize: "0.84rem",
              }}
            >
              {dashboard.error.message}
            </div>
          ) : null}
        </div>
      )}

      <PasscodeModal
        isOpen={isPasscodeModalOpen}
        mode={passcodeMode}
        isSubmitting={isSubmitting}
        error={modalError}
        onClose={() => setIsPasscodeModalOpen(false)}
        onSubmit={handlePasscodeSubmit}
      />
    </>
  );
}
