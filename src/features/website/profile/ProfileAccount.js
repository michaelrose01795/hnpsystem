// file location: src/features/website/profile/ProfileAccount.js
//
// The Account view: everything personal, in four subsections.
//
//   Profile     | name, contact details and how we reach you
//   Preferences | notifications, the typing assistant, the site theme
//   Household   | who is on the account and the vehicles it covers
//   Privacy     | password, email, referral, activity, data export/deletion
//
// Privacy keeps the destructive requests visually apart from ordinary
// settings, in their own card at the end. Every endpoint these rows call is
// the one they called before the portal was split into views.

import { useState } from "react";
import {
  DetailField,
  DetailFieldGrid,
  PortalCard,
  SubNav,
} from "./ProfilePrimitives";
import { FieldInput } from "./ProfileForms";
import {
  ChangeEmailRow,
  ChangePasswordRow,
  DataActionsRow,
  NotificationPrefsRow,
  ReferralRow,
  TypingAssistRow,
} from "./ProfileAccountForms";
import WebsiteNativeSelect from "@/features/website/components/WebsiteNativeSelect";
import {
  CONTACT_PREFERENCE_OPTIONS,
  contactPreferenceLabel,
} from "@/lib/customers/contactPreference";
import { formatDate, humaniseActivity, vehicleReg, vehicleTitle } from "./profileUtils";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "household", label: "Household" },
  { id: "privacy", label: "Privacy" },
];

export default function ProfileAccount({
  customer,
  fullName,
  vehicles,
  timeline,
  section,
  onSectionChange,
  editing,
  onEditingChange,
  editForm,
  onEditFormChange,
  onSaveProfile,
  saving,
  saveError,
  themeLabel,
  onCycleTheme,
  onLogout,
  onFlash,
  onRefresh,
  onReferral,
  onExportData,
  onDeleteAccount,
  actionFlash,
}) {
  // Activity opens on the last six events; the rest is a tap away.
  const [showAllActivity, setShowAllActivity] = useState(false);
  return (
    <div className="ws-profile-view" data-presentation="website-profile-account">
      <SubNav
        label="Account sections"
        items={SECTIONS}
        value={section}
        onChange={onSectionChange}
        idPrefix="ws-profile-account"
      />

      {section === "profile" ? (
        <PortalCard
          eyebrow="Your details"
          title="Personal details"
          action={
            !editing ? (
              <button type="button" onClick={() => onEditingChange(true)}>
                Edit
              </button>
            ) : null
          }
          wide
        >
          {editing ? (
            <form className="ws-portal-form" onSubmit={onSaveProfile}>
              {saveError ? <p className="ws-portal-error">{saveError}</p> : null}
              <div className="ws-portal-form-row">
                <FieldInput
                  label="First name"
                  value={editForm.firstname}
                  onChange={(v) => onEditFormChange({ ...editForm, firstname: v })}
                />
                <FieldInput
                  label="Last name"
                  value={editForm.lastname}
                  onChange={(v) => onEditFormChange({ ...editForm, lastname: v })}
                />
              </div>
              <div className="ws-portal-form-row">
                <FieldInput
                  label="Mobile"
                  value={editForm.mobile}
                  onChange={(v) => onEditFormChange({ ...editForm, mobile: v })}
                />
                <FieldInput
                  label="Telephone"
                  value={editForm.telephone}
                  onChange={(v) => onEditFormChange({ ...editForm, telephone: v })}
                />
              </div>
              <FieldInput
                label="Address"
                value={editForm.address}
                onChange={(v) => onEditFormChange({ ...editForm, address: v })}
              />
              <div className="ws-portal-form-row">
                <FieldInput
                  label="Postcode"
                  value={editForm.postcode}
                  onChange={(v) => onEditFormChange({ ...editForm, postcode: v })}
                />
                <div className="ws-portal-field">
                  <label className="ws-portal-label">Contact preference</label>
                  <WebsiteNativeSelect
                    value={editForm.contact_preference}
                    onChange={(value) => onEditFormChange({ ...editForm, contact_preference: value })}
                    options={CONTACT_PREFERENCE_OPTIONS}
                  />
                </div>
              </div>
              <div className="ws-portal-action-row">
                <button type="submit" className="app-btn ws-portal-grow" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onEditingChange(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <DetailFieldGrid>
              <DetailField label="Name" value={fullName} />
              <DetailField label="Email" value={customer.email} />
              <DetailField label="Mobile" value={customer.mobile} />
              <DetailField label="Telephone" value={customer.telephone} />
              <DetailField label="Address" value={customer.address} />
              <DetailField label="Postcode" value={customer.postcode} />
              <DetailField
                label="Preferred contact"
                value={contactPreferenceLabel(customer.contact_preference) || customer.contact_preference}
              />
            </DetailFieldGrid>
          )}
        </PortalCard>
      ) : null}

      {section === "preferences" ? (
        <div className="ws-portal-split">
          <PortalCard eyebrow="Contact" title="How we reach you">
            <NotificationPrefsRow
              initial={customer}
              onSuccess={() => onFlash("prefs", "Preferences saved.")}
              flash={actionFlash.prefs}
            />
          </PortalCard>
          <PortalCard eyebrow="This device" title="Site and typing">
            <div className="ws-portal-settings-row">
              <div className="ws-portal-card__header">
                <div>
                  <div className="ws-portal-item-title">Appearance</div>
                  <p className="ws-portal-hint">Light, dark, or follow your device.</p>
                </div>
                <button type="button" onClick={onCycleTheme}>
                  {themeLabel}
                </button>
              </div>
            </div>
            <TypingAssistRow />
          </PortalCard>
        </div>
      ) : null}

      {section === "household" ? (
        <div className="ws-portal-split">
          <PortalCard eyebrow="Household" title="Who is on this account">
            <ul className="ws-portal-list">
              <li className="ws-portal-row">
                <div>
                  <div className="ws-portal-item-title">{fullName}</div>
                  <div className="ws-portal-item-meta">
                    {[customer.email, `${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <span className="ws-portal-badge" data-tone="ok">
                  Account holder
                </span>
              </li>
            </ul>
            <p className="ws-portal-empty">
              Want someone else in the household to book and collect for you? Send us a message and we&apos;ll set it
              up.
            </p>
          </PortalCard>
          <PortalCard eyebrow="Garage" title="Vehicles on this account" count={vehicles.length}>
            {vehicles.length === 0 ? (
              <p className="ws-portal-empty">No vehicles are linked to this account yet.</p>
            ) : (
              <ul className="ws-portal-list">
                {vehicles.map((vehicle) => (
                  <li key={vehicle.vehicle_id || vehicle.reg_number} className="ws-portal-row ws-portal-row--single">
                    <div>
                      <div className="ws-portal-item-title">{vehicleReg(vehicle)}</div>
                      <div className="ws-portal-item-meta">{vehicleTitle(vehicle)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>
        </div>
      ) : null}

      {section === "privacy" ? (
        <>
          <PortalCard eyebrow="Sign in" title="Sign-in details" wide>
            <ChangePasswordRow onSuccess={() => onFlash("pw", "Password updated.")} flash={actionFlash.pw} />
            <ChangeEmailRow
              currentEmail={customer.email}
              onSuccess={() => {
                onFlash("email", "Email updated.");
                onRefresh();
              }}
              flash={actionFlash.email}
            />
          </PortalCard>

          <div className="ws-portal-split">
            <PortalCard eyebrow="Activity" title="Recent account activity" count={timeline.length}>
              {timeline.length === 0 ? (
                <p className="ws-portal-empty">Once you have booked in or had work done, it will show here.</p>
              ) : (
                <div className="ws-portal-timeline">
                  {timeline.slice(0, showAllActivity ? 30 : 6).map((event) => (
                    <div key={event.event_id} className="ws-portal-timeline__row">
                      <span className="ws-portal-when">{formatDate(event.occurred_at)}</span>
                      <span className="ws-portal-timeline__what">{humaniseActivity(event)}</span>
                    </div>
                  ))}
                </div>
              )}
              {timeline.length > 6 ? (
                <button
                  type="button"
                  className="ws-portal-action-start"
                  onClick={() => setShowAllActivity((v) => !v)}
                >
                  {showAllActivity ? "Show fewer" : `View all (${timeline.length})`}
                </button>
              ) : null}
            </PortalCard>

            <PortalCard eyebrow="Thank you" title="Refer a friend">
              <ReferralRow onSubmit={onReferral} flash={actionFlash.ref} />
            </PortalCard>
          </div>

          {/* Kept in its own card at the end: these requests are not ordinary
              settings and should not sit next to them. */}
          <PortalCard eyebrow="Your data" title="Data and account requests" wide>
            <DataActionsRow
              onExport={onExportData}
              onDelete={onDeleteAccount}
              flashExp={actionFlash.exp}
              flashDel={actionFlash.del}
            />
            <div className="ws-portal-settings-row">
              <div className="ws-portal-card__header">
                <div>
                  <div className="ws-portal-item-title">Sign out</div>
                  <p className="ws-portal-hint">Sign out of your account on this device.</p>
                </div>
                <button type="button" onClick={onLogout}>
                  Log out
                </button>
              </div>
            </div>
          </PortalCard>
        </>
      ) : null}
    </div>
  );
}
