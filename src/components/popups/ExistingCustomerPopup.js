// ✅ Imports converted to use absolute alias "@/"
// ✅ File location: src/components/popups/ExistingCustomerPopup.js
import React, { useState, useEffect } from "react";
import { searchCustomers } from "@/lib/database/customers"; // ✅ use shared function
import ModalPortal from "./ModalPortal";

// ExistingCustomerPopup component
export default function ExistingCustomerPopup({ onClose, onSelect }) {
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

  /* ============================================
     RENDER POPUP
  ============================================ */
  return (
    <ModalPortal>
      <div className="popup-backdrop">
        <div
          className="popup-card"
          style={{
            padding: "24px",
            borderRadius: "10px",
            width: "420px",
            maxHeight: "90vh",
            overflowY: "auto",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Select Existing Customer</h3>

        {/* Search input */}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or mobile"
          style={{
            width: "100%",
            marginBottom: "12px",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid var(--search-surface-muted)",
            backgroundColor: "var(--search-surface)",
            color: "var(--search-text)",
          }}
        />

        {/* List results */}
        {customerList.length > 0 && (
          <div
            style={{
              maxHeight: "200px",
              overflowY: "auto",
              marginBottom: "12px",
              border: "1px solid var(--surface-light)",
              borderRadius: "6px",
            }}
          >
            {customerList.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedCustomer(c)}
                style={{
                  padding: "8px",
                  cursor: "pointer",
                  backgroundColor:
                    selectedCustomer?.id === c.id ? "var(--surface)" : "var(--row-background)",
                  color: "var(--text-color)",
                  borderBottom: "1px solid var(--surface-light)",
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
            marginBottom: "12px",
            backgroundColor: "var(--row-background)",
            color: "var(--text-color)",
            padding: "12px",
            borderRadius: "6px"
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
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={onClose} style={{ padding: "8px 16px" }}>
            Close
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedCustomer}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: selectedCustomer ? "pointer" : "not-allowed",
            }}
          >
            Add Customer
          </button>
        </div>
        </div>
      </div>
    </ModalPortal>
  );
}
