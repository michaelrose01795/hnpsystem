// file location: src/features/customers/hub/CustomerHistoryTab.js
//
// The complete dealership history for one customer, on a single timeline:
// jobs, appointments, invoices, payments, VHCs, estimates, warranty work, MOTs
// and vehicle changes — all built from tables that already exist.

import React, { useMemo, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import InputField from "@/components/ui/InputField";
import { prefetchJob } from "@/lib/swr/prefetch";
import {
  RecordFieldGrid,
  RecordHeading,
  StatusBadge,
  Timeline,
  TimelineHead,
  LinkButton,
} from "./RecordPrimitives";
import {
  HISTORY_FILTERS,
  filterTimeline,
  formatDate,
  formatDateTime,
} from "@/lib/customers/customerHubModel";

const KIND_LABELS = {
  job: "Job",
  appointment: "Appointment",
  invoice: "Invoice",
  payment: "Payment",
  vhc: "VHC",
  mot: "MOT",
  warranty: "Warranty",
  estimate: "Estimate",
  vehicle: "Vehicle",
};

const KIND_TONE = {
  job: "accent-soft",
  appointment: "accent-soft",
  invoice: "warning",
  payment: "success",
  vhc: "neutral",
  mot: "warning",
  warranty: "accent-soft",
  estimate: "neutral",
  vehicle: "neutral",
};

const PAGE_SIZE = 25;

export default function CustomerHistoryTab({ entries = [], initialSearch = "", access }) {
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState(initialSearch);
  const [limit, setLimit] = useState(PAGE_SIZE);

  // A search handed in from elsewhere on the page (e.g. "open vehicle history"
  // on a vehicle card) should replace what is in the box.
  const [lastInitial, setLastInitial] = useState(initialSearch);
  if (initialSearch !== lastInitial) {
    setLastInitial(initialSearch);
    setSearch(initialSearch);
    setKind("all");
    setLimit(PAGE_SIZE);
  }

  const filtered = useMemo(() => filterTimeline(entries, { kind, search }), [entries, kind, search]);
  const visible = filtered.slice(0, limit);

  const counts = useMemo(() => {
    const tally = new Map();
    entries.forEach((entry) => tally.set(entry.kind, (tally.get(entry.kind) || 0) + 1));
    return tally;
  }, [entries]);

  const filterOptions = HISTORY_FILTERS.map((option) => ({
    value: option.value,
    label:
      option.value === "all"
        ? `${option.label} (${entries.length})`
        : `${option.label} (${counts.get(option.value) || 0})`,
  }));

  if (!entries.length) {
    return (
      <EmptyState
        variant="page"
        icon="📚"
        title="No dealership history yet"
        description="Jobs, appointments, invoices, payments and health checks all appear here as soon as the first one is raised."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap)", minWidth: 0 }}>
      <LayerTheme as="section" sectionKey="customer-profile-history-filters" parentKey="customer-profile-tab-history">
        <RecordHeading>{`History (${filtered.length} of ${entries.length} events)`}</RecordHeading>
        <div className="app-filter-bar">
          <div className="app-filter-bar__controls">
            <InputField
              label="Search history"
              id="customer-history-search"
              type="search"
              value={search}
              placeholder="Registration, job number, invoice, status…"
              onChange={(event) => {
                setSearch(event.target.value);
                setLimit(PAGE_SIZE);
              }}
            />
            <DropdownField
              label="Event type"
              value={kind}
              options={filterOptions}
              onChange={(event) => {
                setKind(event.target.value);
                setLimit(PAGE_SIZE);
              }}
            />
          </div>
          <div className="app-filter-bar__actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setKind("all");
                setLimit(PAGE_SIZE);
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </LayerTheme>

      <LayerTheme as="section" sectionKey="customer-profile-history-list" parentKey="customer-profile-tab-history">
        {visible.length === 0 ? (
          <EmptyState
            variant="bare"
            role="status"
            icon="🔍"
            title="Nothing matches those filters"
            description="Try a different event type, or clear the search."
          />
        ) : (
          <LayerSurface as="div" sectionKey="customer-profile-history-timeline" parentKey="customer-profile-history-list">
            <Timeline
              entries={visible}
              renderEntry={(entry) => (
                <>
                  <TimelineHead
                    title={entry.title}
                    time={
                      entry.kind === "appointment" || entry.kind === "payment"
                        ? formatDateTime(entry.at)
                        : formatDate(entry.at)
                    }
                    badge={
                      <>
                        <StatusBadge tone={KIND_TONE[entry.kind] || "neutral"}>
                          {KIND_LABELS[entry.kind] || entry.kind}
                        </StatusBadge>
                        {entry.status && <StatusBadge tone="neutral">{entry.status}</StatusBadge>}
                        {entry.vehicle && <StatusBadge tone="neutral">{entry.vehicle}</StatusBadge>}
                      </>
                    }
                  />
                  {entry.subtitle && <p className="app-record-note">{entry.subtitle}</p>}
                  <RecordFieldGrid fields={entry.fields || []} />
                  {(entry.jobNumber || (entry.invoiceId && access?.canViewFinancials)) && (
                    <div className="app-timeline__meta">
                      {entry.jobNumber && (
                        <LinkButton
                          href={`/job-cards/${encodeURIComponent(entry.jobNumber)}`}
                          variant="ghost"
                          onMouseEnter={() => prefetchJob(entry.jobNumber)}
                        >
                          {`Job ${entry.jobNumber}`}
                        </LinkButton>
                      )}
                      {entry.invoiceId && access?.canViewFinancials && (
                        <LinkButton
                          href={`/accounts/invoices/${encodeURIComponent(entry.invoiceId)}`}
                          variant="ghost"
                        >
                          View invoice
                        </LinkButton>
                      )}
                    </div>
                  )}
                </>
              )}
            />
          </LayerSurface>
        )}

        {filtered.length > visible.length && (
          <div className="app-record-actions">
            <Button variant="secondary" size="sm" onClick={() => setLimit((value) => value + PAGE_SIZE)}>
              {`Show ${Math.min(PAGE_SIZE, filtered.length - visible.length)} more`}
            </Button>
          </div>
        )}
      </LayerTheme>
    </div>
  );
}
