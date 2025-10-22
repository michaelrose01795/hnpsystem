// ✅ File location: src/components/popups/ExistingCustomerPopup.js
import React, { useState, useEffect } from "react";
import { searchCustomers } from "../../lib/database/customers"; // ✅ use shared function

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
        <h3 style={{ marginTop: 0 }}>Select Existing Customer</h3>

        {/* Search input */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or mobile"
          style={{ width: "100%", marginBottom: "12px", padding: "6px" }}
        />

        {/* List results */}
        {customerList.length > 0 && (
          <div
            style={{
              maxHeight: "200px",
              overflowY: "auto",
              marginBottom: "12px",
              border: "1px solid #ddd",
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
                    selectedCustomer?.id === c.id ? "#f8f8f8" : "white",
                  borderBottom: "1px solid #eee",
                }}
              >
                {c.firstname} {c.lastname}
              </div>
            ))}
          </div>
        )}

        {/* Show selected customer details */}
        {selectedCustomer && (
          <div style={{ marginBottom: "12px" }}>
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
              backgroundColor: "#FF4040",
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
  );
}
