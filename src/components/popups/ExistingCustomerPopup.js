// ✅ Imports converted to use absolute alias "@/"
// ✅ File location: src/components/popups/ExistingCustomerPopup.js
import React, { useState, useEffect } from "react";
import { searchCustomers } from "@/lib/database/customers"; // ✅ use shared function
import PopupModal from "@/components/popups/popupStyleApi";
import { SearchBar } from "@/components/ui/searchBarAPI";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import StatusMessage from "@/components/ui/StatusMessage";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";
import { logFailure } from "@/lib/utils/logFailure";

const SEARCH_DEBOUNCE_MS = 250;

// ExistingCustomerPopup component
export default function ExistingCustomerPopup({ onClose, onSelect, onCreateNew }) {
  const [search, setSearch] = useState(""); // text input for name search
  const [customerList, setCustomerList] = useState([]); // customers from DB
  const [selectedCustomer, setSelectedCustomer] = useState(null); // chosen customer
  const [searchStatus, setSearchStatus] = useState("idle");

  /* ============================================
     FETCH CUSTOMERS WHEN SEARCH CHANGES
     Uses shared searchCustomers() from database
  ============================================ */
  useEffect(() => {
    const searchTerm = search.trim();
    let cancelled = false;

    setSelectedCustomer(null);

    if (!searchTerm) {
      setCustomerList([]);
      setSearchStatus("idle");
      return undefined;
    }

    setCustomerList([]);
    setSearchStatus("loading");

    const timer = window.setTimeout(async () => {
      try {
        const data = await searchCustomers(searchTerm);
        if (cancelled) return;
        setCustomerList(data || []);
        setSearchStatus("success");
      } catch (error) {
        if (cancelled) return;
        logFailure("Existing customer search failed:", error);
        setCustomerList([]);
        setSearchStatus("error");
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
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
  const noResults = hasSearch && searchStatus === "success" && customerList.length === 0;
  const canCreateNew = noResults && typeof onCreateNew === "function";
  const primaryButtonLabel = canCreateNew ? "New Customer" : "Add Customer";
  const canUsePrimary = canCreateNew || !!selectedCustomer;
  const handlePrimaryClick = () => {
    if (canCreateNew) {
      onCreateNew(parseName(search));
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

        {searchStatus === "loading" && (
          <div style={{ marginBottom: "16px" }}>
            <InlineLoading label="Searching customers" width={150} />
          </div>
        )}

        {searchStatus === "error" && (
          <StatusMessage tone="danger" style={{ marginBottom: "16px" }}>
            Unable to search customers. Please try again.
          </StatusMessage>
        )}

        {customerList.length > 0 && (
          <LayerTheme
            role="listbox"
            aria-label="Customer search results"
            radius="var(--control-menu-radius)"
            padding="8px"
            gap="8px"
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
                role="option"
                aria-selected={selectedCustomer?.id === c.id}
                className={`dropdown-api__option${selectedCustomer?.id === c.id ? " is-selected" : ""}`}
              >
                <span className="dropdown-api__option-label">
                  {c.firstname} {c.lastname}
                </span>
                {(c.email || c.mobile) && (
                  <span className="dropdown-api__option-description">
                    {[c.email, c.mobile].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
            ))}
          </LayerTheme>
        )}

        {noResults && (
          <StatusMessage tone="info" style={{ marginBottom: "16px" }}>
            No existing customers found.
          </StatusMessage>
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
              <strong>Address:</strong> {selectedCustomer.address || "Not provided"}
            </p>
            <p>
              <strong>Email:</strong> {selectedCustomer.email || "Not provided"}
            </p>
            <p>
              <strong>Mobile:</strong> {selectedCustomer.mobile || "Not provided"}
            </p>
            <p>
              <strong>Telephone:</strong> {selectedCustomer.telephone || "Not provided"}
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
