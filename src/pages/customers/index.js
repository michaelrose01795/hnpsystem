// file location: src/pages/customers/index.js
//
// The staff customer list — every customer in the database, searchable,
// sortable and paginated, each row linking through to the customer record at
// /customers/[customerSlug]. Mirrors the structure of the jobs list: this file
// is the container (data + state), the presentation lives in
// src/components/page-ui/customers/customers-ui.js.
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { FilterToolbarRow, PageShell, SectionShell } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import {
  CUSTOMER_DIRECTORY_PAGE_SIZE,
  getCustomersDirectory,
} from "@/lib/database/customers";
import { createCustomerDisplaySlug } from "@/lib/customers/slug";
import CustomersIndexUi from "@/components/page-ui/customers/customers-ui"; // Extracted presentation layer.

const SEARCH_DEBOUNCE_MS = 300;

const SORT_OPTIONS = [
  { value: "recent", label: "Sort: Newest first" },
  { value: "oldest", label: "Sort: Oldest first" },
  { value: "name", label: "Sort: Surname A–Z" },
];

const formatAddedDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// The record page resolves either a display slug ("JohnSmith") or the raw id,
// so fall back to the id when a customer has no usable name. The name columns
// are nullable and createCustomerDisplaySlug only defaults on undefined, so
// coerce here — trade accounts carry a null firstname and lastname.
const buildCustomerHref = (customer) => {
  const slug = createCustomerDisplaySlug(
    customer?.firstname || "",
    customer?.lastname || ""
  );
  const target = slug || customer?.id;
  return target ? `/customers/${encodeURIComponent(target)}` : null;
};

export default function CustomersIndexPage() {
  const router = useRouter();

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(0);

  const [customers, setCustomers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Guards against a slow earlier request overwriting a newer result.
  const requestIdRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // A new search or sort invalidates the current page position.
  useEffect(() => {
    setPage(0);
  }, [appliedSearch, sort]);

  useEffect(() => {
    let cancelled = false;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLoading(true);
    getCustomersDirectory({
      limit: CUSTOMER_DIRECTORY_PAGE_SIZE,
      offset: page * CUSTOMER_DIRECTORY_PAGE_SIZE,
      search: appliedSearch,
      sort,
    })
      .then((result) => {
        if (cancelled || requestIdRef.current !== requestId) return;
        setCustomers(result.data);
        setTotalCount(result.count);
        setErrorMessage(result.error ? "Could not load customers. Please try again." : "");
      })
      .catch(() => {
        if (cancelled || requestIdRef.current !== requestId) return;
        setCustomers([]);
        setTotalCount(0);
        setErrorMessage("Could not load customers. Please try again.");
      })
      .finally(() => {
        if (cancelled || requestIdRef.current !== requestId) return;
        setLoading(false);
        setHasLoadedOnce(true);
      });

    return () => {
      cancelled = true;
    };
  }, [appliedSearch, sort, page]);

  const rows = useMemo(
    () =>
      customers.map((customer) => ({
        id: customer.id,
        href: buildCustomerHref(customer),
        displayName: customer.displayName,
        email: customer.email || "",
        mobile: customer.mobile || customer.telephone || "",
        address: customer.address || "",
        postcode: customer.postcode || "",
        vehicleCount: customer.vehicleCount,
        jobCount: customer.jobCount,
        addedLabel: formatAddedDate(customer.created_at),
      })),
    [customers]
  );

  const pageCount = Math.max(1, Math.ceil(totalCount / CUSTOMER_DIRECTORY_PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : page * CUSTOMER_DIRECTORY_PAGE_SIZE + 1;
  const rangeEnd = page * CUSTOMER_DIRECTORY_PAGE_SIZE + rows.length;

  const goToCustomer = useCallback(
    (href) => {
      if (href) router.push(href);
    },
    [router]
  );

  const handleSearchChange = useCallback((event) => {
    setSearchInput(event.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
  }, []);

  const handleSortChange = useCallback((value) => {
    setSort(value);
  }, []);

  const goToPreviousPage = useCallback(() => {
    setPage((current) => Math.max(0, current - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPage((current) => (current + 1 < pageCount ? current + 1 : current));
  }, [pageCount]);

  // Only the very first load blanks the page; later fetches keep the current
  // rows on screen so typing in the search box does not flash a skeleton.
  if (!hasLoadedOnce) {
    return <CustomersIndexUi view="section1" PageSkeleton={PageSkeleton} />;
  }

  return (
    <CustomersIndexUi
      view="section2"
      DevLayoutSection={DevLayoutSection}
      DropdownField={DropdownField}
      FilterToolbarRow={FilterToolbarRow}
      PageShell={PageShell}
      SearchBar={SearchBar}
      SectionShell={SectionShell}
      errorMessage={errorMessage}
      goToCustomer={goToCustomer}
      goToNextPage={goToNextPage}
      goToPreviousPage={goToPreviousPage}
      handleClearSearch={handleClearSearch}
      handleSearchChange={handleSearchChange}
      handleSortChange={handleSortChange}
      hasNextPage={page + 1 < pageCount}
      hasPreviousPage={page > 0}
      loading={loading}
      pageCount={pageCount}
      pageNumber={page + 1}
      rangeEnd={rangeEnd}
      rangeStart={rangeStart}
      rows={rows}
      searchInput={searchInput}
      searchTerm={appliedSearch}
      sort={sort}
      sortOptions={SORT_OPTIONS}
      totalCount={totalCount}
    />
  );
}
