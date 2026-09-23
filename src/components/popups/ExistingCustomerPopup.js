// file location: src/components/popups/ExistingCustomerPopup.js
import React, { useEffect, useState } from "react";
import { searchCustomers } from "@/lib/database/customers";
import PopupModal from "@/components/popups/popupStyleApi";
import { SearchBar } from "@/components/ui/searchBarAPI";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import StatusMessage from "@/components/ui/StatusMessage";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";
import { logFailure } from "@/lib/utils/logFailure";

const SEARCH_DEBOUNCE_MS = 250;

export default function ExistingCustomerPopup({ onClose, onSelect, onCreateNew }) {
  const [search, setSearch] = useState("");
  const [customerList, setCustomerList] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchStatus, setSearchStatus] = useState("idle");

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

  const parseName = (raw) => {
    const trimmed = (raw || "").trim().replace(/\s+/g, " ");
    if (!trimmed) return { firstName: "", lastName: "" };
    const [firstName = "", ...remainingName] = trimmed.split(" ");
    return { firstName, lastName: remainingName.join(" ").trim() };
  };

  const hasSearch = search.trim().length > 0;
  const noResults = hasSearch && searchStatus === "success" && customerList.length === 0;
  const canCreateNew = noResults && typeof onCreateNew === "function";
  const canUsePrimary = canCreateNew || Boolean(selectedCustomer);

  const handlePrimaryClick = () => {
    if (canCreateNew) {
      onCreateNew(parseName(search));
      onClose?.();
      return;
    }
    if (!selectedCustomer) return;
    onSelect(selectedCustomer);
    onClose?.();
  };

  return (
    <PopupModal onClose={onClose} cardStyle={{ maxWidth: "650px" }} ariaLabel="Existing customer">
      <div className="app-page-stack" style={{ padding: "var(--section-card-padding)" }}>
        <header className="app-popup-compact-header">
          <h3>Find a customer</h3>
          <div className="app-popup-compact-header__actions">
            <Button type="button" onClick={handlePrimaryClick} disabled={!canUsePrimary}>
              {canCreateNew ? "New customer" : "Add customer"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        <SearchBar
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
          placeholder="Search by name, email, or mobile"
        />

        {searchStatus === "loading" ? <InlineLoading label="Searching customers" width={150} /> : null}
        {searchStatus === "error" ? (
          <StatusMessage tone="danger">Unable to search customers. Please try again.</StatusMessage>
        ) : null}

        {customerList.length > 0 ? (
          <LayerTheme
            sectionKey="existing-customer-results"
            parentKey="shared-popup-card"
            sectionType="content-card"
            role="listbox"
            aria-label="Customer search results"
            radius="var(--control-menu-radius)"
            padding="var(--space-sm)"
            gap="var(--space-sm)"
            style={{ maxHeight: "220px", overflowY: "auto" }}
          >
            {customerList.map((customer) => (
              <button
                type="button"
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                role="option"
                aria-selected={selectedCustomer?.id === customer.id}
                className={`dropdown-api__option${selectedCustomer?.id === customer.id ? " is-selected" : ""}`}
              >
                <span className="dropdown-api__option-label">
                  {customer.firstname} {customer.lastname}
                </span>
                {customer.email || customer.mobile ? (
                  <span className="dropdown-api__option-description">
                    {[customer.email, customer.mobile].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </button>
            ))}
          </LayerTheme>
        ) : null}

        {noResults ? <StatusMessage tone="info">No existing customers found.</StatusMessage> : null}

        {selectedCustomer ? (
          <LayerTheme
            sectionKey="existing-customer-summary"
            parentKey="shared-popup-card"
            sectionType="content-card"
            radius="var(--input-radius)"
            padding="var(--section-card-padding-sm)"
          >
            <p><strong>Name:</strong> {selectedCustomer.firstname} {selectedCustomer.lastname}</p>
            <p><strong>Address:</strong> {selectedCustomer.address || "Not provided"}</p>
            <p><strong>Email:</strong> {selectedCustomer.email || "Not provided"}</p>
            <p><strong>Mobile:</strong> {selectedCustomer.mobile || "Not provided"}</p>
            <p><strong>Telephone:</strong> {selectedCustomer.telephone || "Not provided"}</p>
          </LayerTheme>
        ) : null}
      </div>
    </PopupModal>
  );
}
