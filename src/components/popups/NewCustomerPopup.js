// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/popups/NewCustomerPopup.js
import React, { useEffect, useState } from "react"; // import React hooks
import { addCustomerToDatabase } from "@/lib/database/customers"; // import database function
import PopupModal from "@/components/popups/popupStyleApi";
import { reportError, reportWarning } from "@/lib/notifications/report"; // Phase 3 reporting helpers (Phase 10 migration).
import Button from "@/components/ui/Button";
import StatusMessage from "@/components/ui/StatusMessage";

export default function NewCustomerPopup({ onClose, onSelect, initialName }) {
  // State for all form fields
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

  // ✅ Function to handle "Add Customer"
  const handleAdd = async () => {
    const nameTrimmed = firstName.trim();
    const lastTrimmed = lastName.trim();

    // Prevent incomplete submission
    if (!nameTrimmed || !lastTrimmed) {
      reportWarning("Please enter both first and last names.");
      return;
    }

    const addressParts = [
      `${number}`.trim(),
      street.trim(),
      town.trim(),
      county.trim(),
      country.trim(),
      postcode.trim(),
    ]
      .filter((segment) => segment && segment !== "undefined")
      .map((segment) => segment.replace(/\s+/g, " ").trim());
    const formattedAddress = addressParts.join(", ");

    setLoading(true);

    try {
      // Call the shared database function
      const newCustomer = await addCustomerToDatabase({
        firstname: nameTrimmed,
        lastname: lastTrimmed,
        firstName: nameTrimmed,
        lastName: lastTrimmed,
        address: formattedAddress,
        postcode: postcode.trim() || null,
        email: email?.trim() || null,
        mobile: mobile?.trim() || null,
        telephone: telephone?.trim() || null,
      });

      // If insert succeeded, send data to parent
      if (newCustomer && typeof onSelect === "function") {
        onSelect(newCustomer);
      }

      // Close popup
      if (typeof onClose === "function") onClose();
    } catch (error) {
      // Raw error → devInfo; the user sees a friendly message + reference code.
      reportError("Failed to add customer. Please try again.", error, { source: "NewCustomerPopup" });
    } finally {
      setLoading(false);
    }
  };

  const handlePostcodeChange = (value) => {
    setPostcode(value.toUpperCase());
    setLookupState((prev) => ({ ...prev, suggestions: [], error: "" }));
  };

  const applyAddressSuggestion = (suggestion) => {
    if (!suggestion) return;
    const { line1, town: suggestionTown, county: suggestionCounty, country: suggestionCountry, postcode: suggestionPostcode } = suggestion;
    if (line1) {
      const match = line1.match(/^(\d+[A-Za-z]?)[\s,]*(.*)$/);
      if (match) {
        setNumber(match[1] || "");
        setStreet(match[2] || "");
      } else {
        setStreet(line1);
      }
    }
    if (suggestionTown) {
      setTown(suggestionTown);
    }
    if (suggestionCounty) {
      setCounty(suggestionCounty);
    }
    if (suggestionCountry) {
      setCountry(suggestionCountry);
    }
    if (suggestionPostcode) {
      setPostcode(suggestionPostcode.toUpperCase());
    }
    setLookupState({ loading: false, error: "", suggestions: [] });
  };

  const handleAddressLookup = async () => {
    if (!postcode.trim()) {
      setLookupState((prev) => ({
        ...prev,
        error: "Enter a postcode before searching.",
        suggestions: [],
      }));
      return;
    }

    setLookupState({ loading: true, error: "", suggestions: [] });
    try {
      const response = await fetch(`/api/postcode-lookup?postcode=${encodeURIComponent(postcode)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to find that postcode");
      }
      const suggestions = payload.suggestions || [];

      // Automatically fill in the address fields if suggestions are found
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

  // ✅ UI layout for popup
  return (
    <PopupModal
      onClose={onClose}
      cardStyle={{
        maxWidth: "650px",
      }}
      ariaLabel="New customer"
    >
      <>
        {/* Header removed by request */}

        {/* Content */}
        <div style={{ padding: "32px" }}>
          {/* Personal Information Section */}
          <div style={{ marginBottom: "32px" }}>
            <h4>
              Personal Information
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label>
                  First Name
                </label>
                <input
                  className="app-input"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <label>
                  Last Name
                </label>
                <input
                  className="app-input"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter last name"
                />
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div style={{ marginBottom: "32px" }}>
            <h4>
              Address
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "16px" }}>
                <div>
                  <label>
                    Number
                  </label>
                  <input
                    className="app-input"
                    type="text"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="No."
                  />
                </div>
                <div>
                  <label>
                    Street
                  </label>
                  <input
                    className="app-input"
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Street name"
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label>
                    Town/City
                  </label>
                  <input
                    className="app-input"
                    type="text"
                    value={town}
                    onChange={(e) => setTown(e.target.value)}
                    placeholder="Town or city"
                  />
                </div>
                <div>
                  <label>
                    County
                  </label>
                  <input
                    className="app-input"
                    type="text"
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                    placeholder="County"
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "end" }}>
                <div>
                  <label>
                    Postcode
                  </label>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <input
                      className="app-input"
                      type="text"
                      value={postcode}
                      onChange={(e) => handlePostcodeChange(e.target.value)}
                      placeholder="Enter postcode"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <Button
                      type="button"
                      onClick={handleAddressLookup}
                      busy={lookupState.loading}
                    >
                      {lookupState.loading ? "Searching…" : "Lookup"}
                    </Button>
                  </div>
                </div>
                <div>
                  <label>
                    Country
                  </label>
                  <input
                    className="app-input"
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Country"
                  />
                </div>
              </div>

              {lookupState.error && (
                <StatusMessage tone="danger">
                  {lookupState.error}
                </StatusMessage>
              )}

              {lookupState.suggestions.length > 0 && (
                <div
                  className="dropdown-api__menu app-dropdown-menu"
                  style={{
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {lookupState.suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => applyAddressSuggestion(suggestion)}
                      className="dropdown-api__option"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Contact Information Section */}
          <div style={{ marginBottom: "24px" }}>
            <h4>
              Contact Information
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label>
                  Email
                </label>
                <input
                  className="app-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label>
                    Mobile
                  </label>
                  <input
                    className="app-input"
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Mobile number"
                  />
                </div>
                <div>
                  <label>
                    Telephone
                  </label>
                  <input
                    className="app-input"
                    type="text"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="Telephone number"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "24px 32px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <Button
            onClick={onClose}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            busy={loading}
            type="button"
          >
            {loading ? "Saving..." : "Add Customer"}
          </Button>
        </div>
      </>
    </PopupModal>
  );
}
