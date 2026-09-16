// file location: src/features/customers/hub/CustomerActivityTab.js
//
// The audit trail: everything the customer did on the portal and everything
// staff did to the record — booking requests, VHC authorisations, payment and
// statement activity, detail changes, communication and the contact log.
//
// All of it is customer_activity_events, which both the /website portal and the
// staff actions on this page write to.

import React, { useMemo, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import InputField from "@/components/ui/InputField";
import {
  RecordFieldGrid,
  RecordHeading,
  StatusBadge,
  Timeline,
  TimelineHead,
  LinkButton,
} from "./RecordPrimitives";
import CustomerContactLog from "./CustomerContactLog";
import { ACTIVITY_FILTERS, filterActivity, formatDateTime } from "@/lib/customers/customerHubModel";

const PAGE_SIZE = 30;

export default function CustomerActivityTab({
  entries = [],
  activityEvents = [],
  jobs = [],
  access,
  onAddLogEntry,
}) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filtered = useMemo(() => filterActivity(entries, { filter, search }), [entries, filter, search]);
  const visible = filtered.slice(0, limit);
  const actionableCount = entries.filter((entry) => entry.actionable).length;

  const filterOptions = ACTIVITY_FILTERS.map((option) => ({
    value: option.value,
    label:
      option.value === "all"
        ? `${option.label} (${entries.length})`
        : option.value === "actionable"
          ? `${option.label} (${actionableCount})`
          : `${option.label} (${entries.filter((entry) => entry.source === option.value).length})`,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap)", minWidth: 0 }}>
      <CustomerContactLog
        activityEvents={activityEvents}
        jobs={jobs}
        access={access}
        onAddEntry={onAddLogEntry}
      />

      <LayerTheme as="section" sectionKey="customer-profile-activity" parentKey="customer-profile-tab-activity">
        <RecordHeading>{`Customer and staff activity (${filtered.length} of ${entries.length})`}</RecordHeading>

        {!entries.length ? (
          <EmptyState
            variant="bare"
            icon="📡"
            title="No activity recorded"
            description="Portal requests, approvals, payment activity and staff changes all appear here as they happen."
          />
        ) : (
          <>
            <div className="app-filter-bar">
              <div className="app-filter-bar__controls">
                <InputField
                  label="Search activity"
                  id="customer-activity-search"
                  type="search"
                  value={search}
                  placeholder="Event, note, registration, job…"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setLimit(PAGE_SIZE);
                  }}
                />
                <DropdownField
                  label="Show"
                  value={filter}
                  options={filterOptions}
                  onChange={(event) => {
                    setFilter(event.target.value);
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
                    setFilter("all");
                    setLimit(PAGE_SIZE);
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>

            {visible.length === 0 ? (
              <EmptyState
                variant="bare"
                role="status"
                icon="🔍"
                title="Nothing matches those filters"
                description="Try a different source, or clear the search."
              />
            ) : (
              <LayerSurface
                as="div"
                sectionKey="customer-profile-activity-timeline"
                parentKey="customer-profile-activity"
              >
                <Timeline
                  entries={visible}
                  renderEntry={(entry) => (
                    <>
                      <TimelineHead
                        title={entry.title}
                        time={formatDateTime(entry.at)}
                        badge={
                          <>
                            <StatusBadge tone="neutral">{entry.sourceLabel}</StatusBadge>
                            {entry.actionable && <StatusBadge tone="warning">Needs action</StatusBadge>}
                            {entry.vehicle && <StatusBadge tone="accent-soft">{entry.vehicle}</StatusBadge>}
                            {entry.author && <StatusBadge tone="neutral">{entry.author}</StatusBadge>}
                          </>
                        }
                      />
                      {entry.note && <p className="app-record-note">{entry.note}</p>}
                      <RecordFieldGrid fields={entry.fields || []} />
                      {entry.jobNumber && (
                        <div className="app-timeline__meta">
                          <LinkButton
                            href={`/job-cards/${encodeURIComponent(entry.jobNumber)}`}
                            variant="ghost"
                          >
                            {`Job ${entry.jobNumber}`}
                          </LinkButton>
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
          </>
        )}
      </LayerTheme>
    </div>
  );
}
