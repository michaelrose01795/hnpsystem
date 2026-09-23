// file location: src/features/website/profile/ProfileAccountForms.js
//
// The account-management rows shown inside the portal's Account view:
// password, email, notification preferences, typing assistant, referral and
// the data export / deletion requests.
//
// Each row talks to the endpoint it already owned before the portal was split
// into views (/api/website/auth/*), except the data actions and referral,
// which are handed back to the page's shared /api/website/actions call.

import { useState } from "react";
import WebsiteNativeSelect from "@/features/website/components/WebsiteNativeSelect";
import useTypingAssistSettings from "@/hooks/useTypingAssistSettings";
import {
  CONTACT_PREFERENCE_OPTIONS,
  normalizeContactPreference,
} from "@/lib/customers/contactPreference";
import { FieldInput, Toggle } from "./ProfileForms";

export function ChangePasswordRow({ onSuccess, flash }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Password</div>
          <p className="ws-portal-hint">Change the password you use to sign in here.</p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Change"}
        </button>
      </div>
      {open ? (
        <form
          className="ws-portal-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setSaving(true);
            try {
              const res = await fetch("/api/website/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ currentPassword: current, newPassword: next }),
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
          {error ? <p className="ws-portal-error">{error}</p> : null}
          <FieldInput label="Current password" type="password" value={current} onChange={setCurrent} />
          <FieldInput label="New password (min. 12 characters)" type="password" value={next} onChange={setNext} />
          <button type="submit" className="app-btn" disabled={saving}>
            {saving ? "Saving…" : "Update password"}
          </button>
        </form>
      ) : null}
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </div>
  );
}

export function ChangeEmailRow({ currentEmail, onSuccess, flash }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Email</div>
          <p className="ws-portal-hint">{currentEmail || "—"}</p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Change"}
        </button>
      </div>
      {open ? (
        <form
          className="ws-portal-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setSaving(true);
            try {
              const res = await fetch("/api/website/auth/change-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ currentPassword: pw, newEmail: next }),
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
          {error ? <p className="ws-portal-error">{error}</p> : null}
          <FieldInput label="New email" value={next} onChange={setNext} />
          <FieldInput label="Current password" type="password" value={pw} onChange={setPw} />
          <button type="submit" className="app-btn" disabled={saving}>
            {saving ? "Saving…" : "Update email"}
          </button>
        </form>
      ) : null}
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </div>
  );
}

export function NotificationPrefsRow({ initial, onSuccess, flash }) {
  const [channel, setChannel] = useState(normalizeContactPreference(initial?.contact_preference) || "email");
  const [marketingEmail, setMarketingEmail] = useState(false);
  const [marketingSms, setMarketingSms] = useState(false);
  const [serviceReminders, setServiceReminders] = useState(true);
  const [motReminders, setMotReminders] = useState(true);
  const [saving, setSaving] = useState(false);
  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Notifications</div>
          <p className="ws-portal-hint">How and when we contact you.</p>
        </div>
      </div>
      <div className="ws-portal-field">
        <label className="ws-portal-label">Preferred channel</label>
        <WebsiteNativeSelect value={channel} onChange={setChannel} options={CONTACT_PREFERENCE_OPTIONS} />
      </div>
      <Toggle label="MOT reminders" checked={motReminders} onChange={setMotReminders} />
      <Toggle label="Service reminders" checked={serviceReminders} onChange={setServiceReminders} />
      <Toggle label="Marketing email (offers, news)" checked={marketingEmail} onChange={setMarketingEmail} />
      <Toggle label="Marketing SMS" checked={marketingSms} onChange={setMarketingSms} />
      <button
        type="button"
        className="app-btn"
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
                optIns: { marketingEmail, marketingSms, serviceReminders, motReminders },
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
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </div>
  );
}

// Spelling, grammar and Tab word prediction on text boxes (GlobalTypingAssist).
// Saved on this device straight away — there is nothing to submit.
export function TypingAssistRow() {
  const { settings, update } = useTypingAssistSettings();
  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Typing assistant</div>
          <p className="ws-portal-hint">
            UK English spelling and grammar checks on text boxes, with the next word suggested as you type. Press Tab to
            accept a suggestion. Runs on this device only.
          </p>
        </div>
      </div>
      <Toggle label="Typing assistant" checked={settings.enabled} onChange={(value) => update({ enabled: value })} />
      {settings.enabled ? (
        <>
          <Toggle
            label="Check spelling and grammar"
            checked={settings.spelling && settings.grammar}
            onChange={(value) => update({ spelling: value, grammar: value })}
          />
          <Toggle
            label="Flag American spellings"
            checked={settings.ukSpelling}
            onChange={(value) => update({ ukSpelling: value })}
          />
          <Toggle
            label="Suggest the next word"
            checked={settings.predictions}
            onChange={(value) => update({ predictions: value })}
          />
        </>
      ) : null}
    </div>
  );
}

export function ReferralRow({ onSubmit, flash }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Refer a friend</div>
          <p className="ws-portal-hint">Send us a friend who needs us — we&apos;ll take it from there.</p>
        </div>
      </div>
      <div className="ws-portal-form-row">
        <FieldInput label="Their name" value={name} onChange={setName} />
        <FieldInput label="Their email" value={email} onChange={setEmail} />
      </div>
      <FieldInput label="Their phone (optional)" value={phone} onChange={setPhone} />
      <button
        type="button"
        className="app-btn"
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
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </div>
  );
}

export function DataActionsRow({ onExport, onDelete, flashExp, flashDel }) {
  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Your data</div>
          <p className="ws-portal-hint">
            Request a copy of everything we hold, or ask us to remove your account.
          </p>
        </div>
      </div>
      <div className="ws-portal-action-row">
        <button type="button" onClick={onExport}>
          Request data export
        </button>
        <button
          type="button"
          className="app-btn"
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
      {flashExp ? <p className="ws-portal-flash">{flashExp}</p> : null}
      {flashDel ? <p className="ws-portal-flash">{flashDel}</p> : null}
    </div>
  );
}
