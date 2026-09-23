// file location: src/features/customers/hub/CustomerSearchBar.js
//
// Jump to another customer record without leaving the page. Uses the existing
// searchCustomers helper (name, email, phone, postcode) rather than a new API,
// and links straight to the matching record.

import React, { useEffect, useRef, useState } from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import InputField from "@/components/ui/InputField";
import { searchCustomers } from "@/lib/database/customers";
import { createCustomerDisplaySlug } from "@/lib/customers/slug";
import { displayCustomerName } from "@/lib/customers/customerHubModel";
import { logFailure } from "@/lib/utils/logFailure";
import { LinkButton } from "./RecordPrimitives";

const MIN_TERM = 2;
const DEBOUNCE_MS = 250;

const recordHref = (customer) => {
  const slug = createCustomerDisplaySlug(customer.firstname, customer.lastname);
  return `/customers/${encodeURIComponent(slug || customer.slug_key || customer.id)}`;
};

export default function CustomerSearchBar({ currentCustomerId }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    const trimmed = term.trim();
    if (trimmed.length < MIN_TERM) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        const matches = await searchCustomers(trimmed);
        if (cancelled) return;
        setResults((matches || []).filter((match) => String(match.id) !== String(currentCustomerId)).slice(0, 8));
      } catch (error) {
        logFailure("Customer record search failed:", error);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [term, currentCustomerId]);

  return (
    <LayerTheme as="section" sectionKey="customer-profile-search" parentKey="app-layout-page-card">
      <InputField
        label="Find another customer"
        id="customer-record-search"
        type="search"
        value={term}
        placeholder="Name, email, phone or postcode"
        onChange={(event) => setTerm(event.target.value)}
      />

      {term.trim().length >= MIN_TERM && (
        <div className="app-record-actions" role="status">
          {searching && <span className="app-record-note">Searching…</span>}
          {!searching && results.length === 0 && (
            <span className="app-record-note">No other customer matches that.</span>
          )}
          {results.map((customer) => (
            <LinkButton key={customer.id} href={recordHref(customer)} variant="ghost">
              {`${displayCustomerName(customer)} · ${customer.email || customer.mobile || customer.postcode || "no contact"}`}
            </LinkButton>
          ))}
        </div>
      )}
    </LayerTheme>
  );
}
