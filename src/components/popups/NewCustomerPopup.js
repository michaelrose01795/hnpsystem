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
    <div
      className="popup-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && typeof onClose === "function") {
          onClose();
        }
      }}
    >
      <div
        className="popup-card"
        style={{
          borderRadius: "32px",
          width: "100%",
          maxWidth: "650px",
          maxHeight: "90vh",
          overflowY: "auto",
          border: "1px solid var(--surface-light)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 32px",
            borderBottom: "1px solid var(--surface-light)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: "bold",
              color: "var(--primary)",
            }}
          >
            Add New Customer
          </h3>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close customer modal"
            style={{
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "12px",
              border: "none",
              backgroundColor: "transparent",
              color: "#888",
              fontSize: "24px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--surface-light)";
              e.currentTarget.style.color = "#666";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#888";
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "32px" }}>
          {/* Personal Information Section */}
          <div style={{ marginBottom: "32px" }}>
            <h4
              style={{
                margin: "0 0 16px 0",
                fontSize: "14px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--primary)",
              }}
            >
              Personal Information
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#666",
                  }}
                >
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter first name"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "2px solid var(--surface-light)",
                    backgroundColor: "var(--surface-light)",
                    fontSize: "15px",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--surface-light)")}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#666",
                  }}
                >
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter last name"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "2px solid var(--surface-light)",
                    backgroundColor: "var(--surface-light)",
                    fontSize: "15px",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--surface-light)")}
                />
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div style={{ marginBottom: "32px" }}>
            <h4
              style={{
                margin: "0 0 16px 0",
                fontSize: "14px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--primary)",
              }}
            >
              Address
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "16px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#666",
                    }}
                  >
                    Number
                  </label>
                  <input
                    type="text"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="No."
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "2px solid var(--surface-light)",
                      backgroundColor: "var(--surface-light)",
                      fontSize: "15px",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--surface-light)")}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#666",
                    }}
                  >
                    Street
                  </label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Street name"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "2px solid var(--surface-light)",
                      backgroundColor: "var(--surface-light)",
                      fontSize: "15px",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--surface-light)")}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#666",
                    }}
                  >
                    Town/City
                  </label>
                  <input
                    type="text"
                    value={town}
                    onChange={(e) => setTown(e.target.value)}
                    placeholder="Town or city"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "2px solid var(--surface-light)",
                      backgroundColor: "var(--surface-light)",
                      fontSize: "15px",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--surface-light)")}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#666",
                    }}
                  >
                    County
                  </label>
                  <input
                    type="text"
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                    placeholder="County"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "2px solid var(--surface-light)",
                      backgroundColor: "var(--surface-light)",
                      fontSize: "15px",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--surface-light)")}
                  />
                </div>
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#666",
                  }}
                >
                  Country
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Country"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "2px solid var(--surface-light)",
                    backgroundColor: "var(--surface-light)",
                    fontSize: "15px",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--surface-light)")}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#666",
                  }}
                >
                  Postcode
                </label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <input
                    type="text"
                    value={postcode}
                    onChange={(e) => handlePostcodeChange(e.target.value)}
                    placeholder="Enter postcode"
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "2px solid var(--surface-light)",
                      backgroundColor: "var(--surface-light)",
                      fontSize: "15px",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--surface-light)")}
                  />
                  <button
                    type="button"
                    onClick={handleAddressLookup}
                    disabled={lookupState.loading}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "12px",
                      border: "2px solid var(--primary)",
                      backgroundColor: "var(--primary)",
                      color: "white",
                      fontSize: "14px",
                      fontWeight: "bold",
                      cursor: lookupState.loading ? "not-allowed" : "pointer",
                      opacity: lookupState.loading ? 0.6 : 1,
                      transition: "all 0.2s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {lookupState.loading ? "Searching…" : "Lookup"}
                  </button>
                </div>
              </div>

              {lookupState.error && (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "2px solid #fecaca",
                    backgroundColor: "#fef2f2",
                    color: "#dc2626",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  {lookupState.error}
                </div>
              )}

              {lookupState.suggestions.length > 0 && (
                <div
                  style={{
                    border: "2px solid var(--surface-light)",
                    borderRadius: "12px",
                    maxHeight: "200px",
                    overflowY: "auto",
                    backgroundColor: "var(--surface)",
                  }}
                >
                  {lookupState.suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => applyAddressSuggestion(suggestion)}
                      style={{
                        width: "100%",
                        padding: "14px 16px",
                        border: "none",
                        borderBottom: index < lookupState.suggestions.length - 1 ? "1px solid var(--surface-light)" : "none",
                        textAlign: "left",
                        backgroundColor: "var(--surface)",
                        cursor: "pointer",
                        fontSize: "14px",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => (e.target.style.backgroundColor = "var(--surface-light)")}
                      onMouseLeave={(e) => (e.target.style.backgroundColor = "var(--surface)")}
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
            <h4
              style={{
                margin: "0 0 16px 0",
                fontSize: "14px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--primary)",
              }}
            >
              Contact Information
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#666",
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "2px solid var(--surface-light)",
                    backgroundColor: "var(--surface-light)",
                    fontSize: "15px",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--surface-light)")}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#666",
                    }}
                  >
                    Mobile
                  </label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Mobile number"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "2px solid var(--surface-light)",
                      backgroundColor: "var(--surface-light)",
                      fontSize: "15px",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--surface-light)")}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#666",
                    }}
                  >
                    Telephone
                  </label>
                  <input
                    type="text"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="Telephone number"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "2px solid var(--surface-light)",
                      backgroundColor: "var(--surface-light)",
                      fontSize: "15px",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--surface-light)")}
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
            borderTop: "1px solid var(--surface-light)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button
            onClick={onClose}
            type="button"
            style={{
              padding: "12px 24px",
              borderRadius: "12px",
              border: "2px solid var(--surface-light)",
              backgroundColor: "transparent",
              fontSize: "15px",
              fontWeight: "bold",
              color: "var(--text-primary)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--primary)";
              e.currentTarget.style.backgroundColor = "var(--surface-light)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--surface-light)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={loading}
            type="button"
            style={{
              padding: "12px 24px",
              borderRadius: "12px",
              border: "2px solid var(--primary-dark)",
              backgroundColor: "var(--primary)",
              color: "white",
              fontSize: "15px",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              transition: "all 0.2s",
              boxShadow: "none",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.2)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
              }
            }}
          >
            {loading ? "Saving..." : "Add Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}
