// ✅ Imports converted to use absolute alias "@/"
// ✅ File location: src/components/popups/ExistingCustomerPopup.js
import React, { useState, useEffect } from "react";
import { searchCustomers } from "@/lib/database/customers"; // ✅ use shared function
import ModalPortal from "./ModalPortal";

// ExistingCustomerPopup component
export default function ExistingCustomerPopup({ onClose, onSelect, onCreateNew }) {
  const [search, setSearch] = useState(""); // text input for name search
  const [customerList, setCustomerList] = useState([]); // customers from DB
  const [selectedCustomer, setSelectedCustomer] = useState(null); // chosen customer

  /* ============================================
     FETCH CUSTOMERS WHEN SEARCH CHANGES
     Uses shared searchCustomers() from database
  ============================================ */
  useEffect(() => {
    const fetchCustomers = async () => {
      if (!search.trim()) {
        setCustomerList([]); // clear results if search empty
        return;
      }

      const data = await searchCustomers(search); // ✅ uses correct field names internally
      setCustomerList(data || []);
    };

    fetchCustomers(); // run search
  }, [search]);

  /* ============================================
     HANDLE ADDING SELECTED CUSTOMER
  ============================================ */
  const handleAdd = () => {
    if (selectedCustomer) {
      onSelect(selectedCustomer); // send customer to parent
      onClose(); // close popup
    }
  };

  const parseName = (raw) => {
    const trimmed = (raw || "").trim().replace(/\s+/g, " ");
    if (!trimmed) return { firstName: "", lastName: "" };
    const parts = trimmed.split(" ");
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ").trim();
    return { firstName, lastName };
  };

  const hasSearch = search.trim().length > 0;
  const noResults = hasSearch && customerList.length === 0;
  const primaryButtonLabel = noResults ? "New Customer" : "Add Customer";
  const canUsePrimary = noResults || !!selectedCustomer;
  const handlePrimaryClick = () => {
    if (noResults) {
      if (typeof onCreateNew === "function") {
        onCreateNew(parseName(search));
      }
      if (typeof onClose === "function") onClose();
      return;
    }
    handleAdd();
  };

  /* ============================================
     RENDER POPUP
  ============================================ */
  return (
    <ModalPortal>
      <div className="popup-backdrop">
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
        >
          {/* Header removed to match Add New Customer */}

        {/* Search input */}
        <div style={{ padding: "32px" }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or mobile"
            style={{
              width: "100%",
              marginBottom: "16px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid var(--surface-light)",
              backgroundColor: "var(--surface)",
              color: "var(--text-primary)",
            }}
          />

        {/* List results */}
        {customerList.length > 0 && (
          <div
            style={{
              maxHeight: "220px",
              overflowY: "auto",
              marginBottom: "16px",
              border: "1px solid var(--surface-light)",
              borderRadius: "10px",
              backgroundColor: "var(--surface)",
            }}
          >
            {customerList.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedCustomer(c)}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  backgroundColor:
                    selectedCustomer?.id === c.id ? "var(--surface-light)" : "var(--surface)",
                  color: "var(--text-primary)",
                  borderBottom: "1px solid var(--surface-light)",
                  fontSize: "14px",
                  fontWeight: selectedCustomer?.id === c.id ? 600 : 500,
                }}
              >
                {c.firstname} {c.lastname}
              </div>
            ))}
          </div>
        )}

        {/* Show selected customer details */}
        {selectedCustomer && (
          <div style={{
            marginBottom: "16px",
            backgroundColor: "var(--surface-light)",
            color: "var(--text-primary)",
            padding: "16px",
            borderRadius: "10px",
            border: "1px solid var(--surface-light)",
            fontSize: "14px",
            lineHeight: 1.5,
          }}>
            <p>
              <strong>Name:</strong> {selectedCustomer.firstname}{" "}
              {selectedCustomer.lastname}
            </p>
            <p>
              <strong>Address:</strong> {selectedCustomer.address}
            </p>
            <p>
              <strong>Email:</strong> {selectedCustomer.email}
            </p>
            <p>
              <strong>Mobile:</strong> {selectedCustomer.mobile}
            </p>
            <p>
              <strong>Telephone:</strong> {selectedCustomer.telephone}
            </p>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px",
              backgroundColor: "var(--surface-light)",
              color: "var(--text-primary)",
              border: "1px solid var(--surface-light)",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Close
          </button>
          <button
            onClick={handlePrimaryClick}
            disabled={!canUsePrimary}
            style={{
              flex: 1,
              padding: "12px",
              backgroundColor: "var(--primary)",
              color: "var(--text-inverse)",
              border: "none",
              borderRadius: "8px",
              cursor: canUsePrimary ? "pointer" : "not-allowed",
              fontWeight: "600",
              opacity: canUsePrimary ? 1 : 0.6,
            }}
          >
            {primaryButtonLabel}
          </button>
        </div>
        </div>
        </div>
      </div>
    </ModalPortal>
  );
}
