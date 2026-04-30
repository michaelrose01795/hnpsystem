// file location: src/components/accounts/AccountUpsertModal.js
import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useRouter } from "next/router";
import PopupModal from "@/components/popups/popupStyleApi";
import AccountForm from "@/components/accounts/AccountForm";
import { DEFAULT_ACCOUNT_FORM_VALUES } from "@/config/accounts";

export default function AccountUpsertModal({ isOpen, mode, accountId, onClose, onSaved }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [account, setAccount] = useState(DEFAULT_ACCOUNT_FORM_VALUES);

  const isEditMode = mode === "edit" && Boolean(accountId);
  const ariaLabel = useMemo(() => (isEditMode ? "Edit account" : "Create account"), [isEditMode]);

  useEffect(() => {
    if (!isOpen) {
      setSaving(false);
      setLoading(false);
      setMessage("");
      setAccount(DEFAULT_ACCOUNT_FORM_VALUES);
      return;
    }

    if (!isEditMode) {
      setAccount(DEFAULT_ACCOUNT_FORM_VALUES);
      setMessage("");
      return;
    }

    const controller = new AbortController();

    const loadAccount = async () => {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch(`/api/accounts/${accountId}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load account");
        }
        setAccount(payload.data || DEFAULT_ACCOUNT_FORM_VALUES);
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Failed to load account", error);
        setMessage(error.message || "Unable to load account");
      } finally {
        setLoading(false);
      }
    };

    loadAccount();
    return () => controller.abort();
  }, [accountId, isEditMode, isOpen]);

  const handleSubmit = async (values) => {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(isEditMode ? `/api/accounts/${accountId}` : "/api/accounts", {
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || (isEditMode ? "Failed to update account" : "Failed to create account"));
      }

      const savedAccount = payload.data || null;
      onSaved?.(savedAccount);
      onClose?.();
      router.push(`/accounts/view/${savedAccount?.account_id || accountId || ""}`);
    } catch (error) {
      console.error(isEditMode ? "Failed to update account" : "Failed to create account", error);
      setMessage(error.message || (isEditMode ? "Unable to update account" : "Unable to create account"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      ariaLabel={ariaLabel}
      cardStyle={{
        maxWidth: "1100px",
        padding: "0",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
        <div style={{ padding: "24px", overflowY: "auto" }}>
          {message && (
            <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "var(--radius-sm)", background: "rgba(var(--danger-rgb), 0.12)", color: "var(--danger-dark)", fontWeight: 600 }}>
              {message}
            </div>
          )}
          {loading ? (
            <p style={{ margin: 0, color: "var(--text-1)" }}>Loading account…</p>
          ) : (
            <AccountForm
              initialValues={account}
              onSubmit={handleSubmit}
              isSubmitting={saving}
              onCancel={onClose}
              hideSectionDescriptions
            />
          )}
        </div>
      </div>
    </PopupModal>
  );
}

AccountUpsertModal.propTypes = {
  isOpen: PropTypes.bool,
  mode: PropTypes.oneOf(["create", "edit"]),
  accountId: PropTypes.string,
  onClose: PropTypes.func,
  onSaved: PropTypes.func,
};

AccountUpsertModal.defaultProps = {
  isOpen: false,
  mode: "create",
  accountId: "",
  onClose: undefined,
  onSaved: undefined,
};
