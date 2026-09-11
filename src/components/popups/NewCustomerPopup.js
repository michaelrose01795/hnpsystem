// file location: src/components/popups/NewCustomerPopup.js
import React, { useEffect, useState } from "react";
import { addCustomerToDatabase } from "@/lib/database/customers";
import PopupModal from "@/components/popups/popupStyleApi";
import { reportError, reportWarning } from "@/lib/notifications/report";
import Button from "@/components/ui/Button";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import StatusMessage from "@/components/ui/StatusMessage";
import ToolbarRow from "@/components/ui/ToolbarRow";

function FormField({ label, children }) {
  return (
    <label>
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function NewCustomerPopup({ onClose, onSelect, initialName }) {
  const [firstName, setFirstName] = useState(initialName?.firstName || "");
  const [lastName, setLastName] = useState(initialName?.lastName || "");
  const [number, setNumber] = useState("");
  const [street, setStreet] = useState("");
  const [town, setTown] = useState("");
  const [county, setCounty] = useState("");
  const [country, setCountry] = useState("United Kingdom");
  const [postcode, setPostcode] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [telephone, setTelephone] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupState, setLookupState] = useState({
    loading: false,
    error: "",
    suggestions: [],
  });

  useEffect(() => {
    if (initialName?.firstName || initialName?.lastName) {
      setFirstName(initialName?.firstName || "");
      setLastName(initialName?.lastName || "");
    }
  }, [initialName]);

  const handleAdd = async () => {
    const nameTrimmed = firstName.trim();
    const lastTrimmed = lastName.trim();
    if (!nameTrimmed || !lastTrimmed) {
      reportWarning("Please enter both first and last names.");
      return;
    }

    const addressParts = [
      number.trim(),
      street.trim(),
      town.trim(),
      county.trim(),
      country.trim(),
      postcode.trim(),
    ]
      .filter((segment) => segment && segment !== "undefined")
      .map((segment) => segment.replace(/\s+/g, " ").trim());

    setLoading(true);
    try {
      const newCustomer = await addCustomerToDatabase({
        firstname: nameTrimmed,
        lastname: lastTrimmed,
        firstName: nameTrimmed,
        lastName: lastTrimmed,
        address: addressParts.join(", "),
        postcode: postcode.trim() || null,
        email: email.trim() || null,
        mobile: mobile.trim() || null,
        telephone: telephone.trim() || null,
      });
      if (newCustomer && typeof onSelect === "function") onSelect(newCustomer);
      onClose?.();
    } catch (error) {
      reportError("Failed to add customer. Please try again.", error, { source: "NewCustomerPopup" });
    } finally {
      setLoading(false);
    }
  };

  const handlePostcodeChange = (value) => {
    setPostcode(value.toUpperCase());
    setLookupState((previous) => ({ ...previous, suggestions: [], error: "" }));
  };

  const applyAddressSuggestion = (suggestion) => {
    if (!suggestion) return;
    const {
      line1,
      town: suggestionTown,
      county: suggestionCounty,
      country: suggestionCountry,
      postcode: suggestionPostcode,
    } = suggestion;

    if (line1) {
      const match = line1.match(/^(\d+[A-Za-z]?)[\s,]*(.*)$/);
      if (match) {
        setNumber(match[1] || "");
        setStreet(match[2] || "");
      } else {
        setStreet(line1);
      }
    }
    if (suggestionTown) setTown(suggestionTown);
    if (suggestionCounty) setCounty(suggestionCounty);
    if (suggestionCountry) setCountry(suggestionCountry);
    if (suggestionPostcode) setPostcode(suggestionPostcode.toUpperCase());
    setLookupState({ loading: false, error: "", suggestions: [] });
  };

  const handleAddressLookup = async () => {
    if (!postcode.trim()) {
      setLookupState((previous) => ({
        ...previous,
        error: "Enter a postcode before searching.",
        suggestions: [],
      }));
      return;
    }

    setLookupState({ loading: true, error: "", suggestions: [] });
    try {
      const response = await fetch(`/api/postcode-lookup?postcode=${encodeURIComponent(postcode)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Unable to find that postcode");
      const suggestions = payload.suggestions || [];
      if (suggestions.length > 0) {
        applyAddressSuggestion(suggestions[0]);
      } else {
        setLookupState({ loading: false, error: "", suggestions: [] });
      }
    } catch (error) {
      setLookupState({
        loading: false,
        error: error.message || "Address lookup failed. Please try again.",
        suggestions: [],
      });
    }
  };

  return (
    <PopupModal onClose={onClose} cardStyle={{ maxWidth: "650px" }} ariaLabel="New customer">
      <form
        className="app-page-stack"
        style={{ padding: "var(--section-card-padding)" }}
        onSubmit={(event) => {
          event.preventDefault();
          handleAdd();
        }}
      >
        <header className="app-popup-compact-header">
          <h3>Add customer</h3>
          <div className="app-popup-compact-header__actions">
            <Button type="submit" busy={loading}>Add customer</Button>
            <Button type="button" variant="secondary" disabled={loading} onClick={onClose}>Close</Button>
          </div>
        </header>

        <LayerTheme sectionKey="new-customer-personal-details" parentKey="shared-popup-card" sectionType="content-card">
          <h4 className="app-staff-card__title">Personal information</h4>
          <div className="app-card-grid">
            <FormField label="First name">
              <input className="app-input" type="text" required autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Enter first name" />
            </FormField>
            <FormField label="Last name">
              <input className="app-input" type="text" required autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Enter last name" />
            </FormField>
          </div>
        </LayerTheme>

        <LayerTheme sectionKey="new-customer-address" parentKey="shared-popup-card" sectionType="content-card">
          <h4 className="app-staff-card__title">Address</h4>
          <div className="app-card-grid">
            <FormField label="Number">
              <input className="app-input" type="text" autoComplete="address-line1" value={number} onChange={(event) => setNumber(event.target.value)} placeholder="No." />
            </FormField>
            <FormField label="Street">
              <input className="app-input" type="text" autoComplete="address-line1" value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Street name" />
            </FormField>
            <FormField label="Town/city">
              <input className="app-input" type="text" autoComplete="address-level2" value={town} onChange={(event) => setTown(event.target.value)} placeholder="Town or city" />
            </FormField>
            <FormField label="County">
              <input className="app-input" type="text" autoComplete="address-level1" value={county} onChange={(event) => setCounty(event.target.value)} placeholder="County" />
            </FormField>
            <div>
              <label htmlFor="new-customer-postcode">Postcode</label>
              <ToolbarRow>
                <input id="new-customer-postcode" className="app-input app-autowidth" type="text" autoComplete="postal-code" value={postcode} onChange={(event) => handlePostcodeChange(event.target.value)} placeholder="Enter postcode" style={{ flex: "1 1 180px", minWidth: 0 }} />
                <Button type="button" variant="secondary" busy={lookupState.loading} onClick={handleAddressLookup}>Lookup</Button>
              </ToolbarRow>
            </div>
            <FormField label="Country">
              <input className="app-input" type="text" autoComplete="country-name" value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Country" />
            </FormField>
          </div>

          {lookupState.error ? <StatusMessage tone="danger">{lookupState.error}</StatusMessage> : null}
          {lookupState.suggestions.length > 0 ? (
            <LayerSurface className="app-dropdown-menu" padding="var(--space-sm)" gap="var(--space-sm)" style={{ maxHeight: "200px", overflowY: "auto" }}>
              {lookupState.suggestions.map((suggestion) => (
                <button key={suggestion.id} type="button" onClick={() => applyAddressSuggestion(suggestion)} className="dropdown-api__option">
                  {suggestion.label}
                </button>
              ))}
            </LayerSurface>
          ) : null}
        </LayerTheme>

        <LayerTheme sectionKey="new-customer-contact-details" parentKey="shared-popup-card" sectionType="content-card">
          <h4 className="app-staff-card__title">Contact information</h4>
          <div className="app-card-grid">
            <FormField label="Email">
              <input className="app-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="customer@example.com" />
            </FormField>
            <FormField label="Mobile">
              <input className="app-input" type="tel" autoComplete="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="Mobile number" />
            </FormField>
            <FormField label="Telephone">
              <input className="app-input" type="tel" value={telephone} onChange={(event) => setTelephone(event.target.value)} placeholder="Telephone number" />
            </FormField>
          </div>
        </LayerTheme>
      </form>
    </PopupModal>
  );
}
