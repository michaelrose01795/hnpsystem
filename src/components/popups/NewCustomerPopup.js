// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/popups/NewCustomerPopup.js
import React, { useState } from "react"; // import React hooks
import { addCustomerToDatabase } from "@/lib/database/customers"; // import database function

export default function NewCustomerPopup({ onClose, onSelect }) {
  // State for all form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [number, setNumber] = useState("");
  const [street, setStreet] = useState("");
  const [town, setTown] = useState("");
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

  // ✅ Function to handle "Add Customer"
  const handleAdd = async () => {
    const nameTrimmed = firstName.trim();
    const lastTrimmed = lastName.trim();

    // Prevent incomplete submission
    if (!nameTrimmed || !lastTrimmed) {
      alert("Please enter both first and last names.");
      return;
    }

    const addressParts = [
      `${number}`.trim(),
      street.trim(),
      town.trim(),
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
      console.error("❌ Error adding customer:", error);
      alert(error.message || "Failed to add customer. Please try again.");
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
    const { line1, town: suggestionTown, country: suggestionCountry, postcode: suggestionPostcode } = suggestion;
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
      setLookupState({ loading: false, error: "", suggestions: payload.suggestions || [] });
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
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          width: "420px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Add New Customer</h3>

        {/* Form fields */}
        {[
          { label: "First Name", value: firstName, setter: setFirstName },
          { label: "Last Name", value: lastName, setter: setLastName },
          { label: "Number", value: number, setter: setNumber },
          { label: "Street", value: street, setter: setStreet },
          { label: "Town/City", value: town, setter: setTown },
          { label: "Country", value: country, setter: setCountry },
          {
            label: "Postcode",
            value: postcode,
            setter: handlePostcodeChange,
            helper: (
              <button
                type="button"
                onClick={handleAddressLookup}
                disabled={lookupState.loading}
                style={{
                  marginTop: "4px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  backgroundColor: lookupState.loading ? "#f3f4f6" : "#f9fafb",
                  color: "#111827",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: lookupState.loading ? "not-allowed" : "pointer",
                }}
              >
                {lookupState.loading ? "Searching…" : "Lookup address"}
              </button>
            ),
          },
          { label: "Email", value: email, setter: setEmail, type: "email" },
          { label: "Mobile", value: mobile, setter: setMobile },
          { label: "Telephone", value: telephone, setter: setTelephone },
        ].map(({ label, value, setter, type = "text", helper }) => (
          <div key={label} style={{ marginBottom: "8px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600" }}>{label}:</label>
            <input
              type={type}
              value={value}
              onChange={(e) => setter(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
              }}
            />
            {helper}
          </div>
        ))}

        {lookupState.error && (
          <div
            style={{
              marginBottom: "12px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #fecaca",
              backgroundColor: "#fef2f2",
              color: "#b91c1c",
              fontSize: "13px",
            }}
          >
            {lookupState.error}
          </div>
        )}

        {lookupState.suggestions.length > 0 && (
          <div
            style={{
              marginBottom: "12px",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              maxHeight: "160px",
              overflowY: "auto",
            }}
          >
            {lookupState.suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => applyAddressSuggestion(suggestion)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "none",
                  borderBottom: "1px solid #e5e7eb",
                  textAlign: "left",
                  backgroundColor: "white",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "12px",
          }}
        >
          <button onClick={onClose} style={{ padding: "8px 16px" }}>
            Close
          </button>
          <button
            onClick={handleAdd}
            disabled={loading}
            style={{
              padding: "8px 16px",
              backgroundColor: "#FF4040",
              color: "white",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Saving..." : "Add Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}
