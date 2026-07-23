// ✅ Imports converted to use absolute alias "@/"
// ✅ File location: src/components/popups/ExistingCustomerPopup.js
import React, { useState, useEffect } from "react";
import { searchCustomers } from "@/lib/database/customers"; // ✅ use shared function
import PopupModal from "@/components/popups/popupStyleApi";
import { SearchBar } from "@/components/ui/searchBarAPI";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";

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
    <PopupModal onClose={onClose} cardStyle={{ maxWidth: "650px" }} ariaLabel="Existing customer">
      <div style={{ padding: "32px" }}>
        <SearchBar
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          placeholder="Search by name, email, or mobile"
          style={{
            width: "100%",
            marginBottom: "16px",
          }}
        />

        {customerList.length > 0 && (
          <div
            className="dropdown-api__menu app-dropdown-menu"
            style={{
              maxHeight: "220px",
              overflowY: "auto",
              marginBottom: "16px",
            }}
          >
            {customerList.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setSelectedCustomer(c)}
                className={`dropdown-api__option${selectedCustomer?.id === c.id ? " is-selected" : ""}`}
              >
                {c.firstname} {c.lastname}
              </button>
            ))}
          </div>
        )}

        {selectedCustomer && (
          <LayerTheme
            radius="var(--input-radius)"
            padding="16px"
            style={{
              marginBottom: "16px",
            }}
          >
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
          </LayerTheme>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            style={{ flex: 1 }}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handlePrimaryClick}
            disabled={!canUsePrimary}
            style={{ flex: 1 }}
          >
            {primaryButtonLabel}
          </Button>
        </div>
      </div>
    </PopupModal>
  );
}
