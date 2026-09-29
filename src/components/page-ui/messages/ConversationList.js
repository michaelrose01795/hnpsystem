// file location: src/components/page-ui/messages/ConversationList.js
//
// The left panel of /messages.
//
//   toolbar   search · filter (All / Unread / @Me + conversation type) ·
//             remove · new — one row of buttons, left-aligned. Search is a
//             button at every width; it opens the portrait-phone search overlay.
//   pins      "Pinned" divider, then up to three pinned conversations sharing
//             one row equally (one = full width, two = halves, three = thirds)
//   divider   "Conversations", above the scrolling list
//   feeds     System notifications and, for service roles, Bookings
//   list      every other conversation, one 44px row each: name, time,
//             unread count. Customer conversations carry a "Customer" tag so
//             internal and external stay distinct at a glance.
//
// Rows are options in a listbox (the selected row carries aria-selected).
// The full preview of the latest message is the row's tooltip. No avatars or
// initials.

import React from "react";
import Button from "@/components/ui/Button";
import SymbolButton from "@/components/ui/SymbolButton";
import StatusMessage from "@/components/ui/StatusMessage";
import EmptyState from "@/components/ui/EmptyState";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { FilterButton, FilterField } from "@/components/ui/filterAPI";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import WebsiteHelpQueue from "@/components/page-ui/messages/WebsiteHelpQueue";
import {
  CONVERSATION_TYPES,
  buildPreview,
  formatListTimestamp,
} from "@/lib/messages/conversationModel";

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  ...CONVERSATION_TYPES.filter((type) => type.value !== "system").map((type) => ({
    value: type.value,
    label: type.label,
    description: type.description,
  })),
];

const onActivate = (handler) => (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    handler();
  }
};

const unreadLabel = (count) => (count > 99 ? "99+" : String(count));

function RowsSkeleton() {
  return (
    <>
      <SkeletonKeyframes />
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="app-msg-row" aria-hidden="true">
          <SkeletonBlock width="55%" height="12px" />
        </div>
      ))}
    </>
  );
}

function rowTooltip(thread, dbUserId) {
  const last = thread.lastMessage;
  const preview = buildPreview(last);
  if (!preview) return thread.title;
  const who = last.senderId === dbUserId ? "You" : last.sender?.firstName || last.sender?.name || "";
  return `${thread.title}\n${who ? `${who}: ` : ""}${preview}`;
}

function ConversationRow({ thread, active, dbUserId, selectionMode, selected, onOpen, onToggleSelect }) {
  const open = () => (selectionMode ? onToggleSelect(thread.id) : onOpen(thread));
  return (
    <div
      role="option"
      aria-selected={selectionMode ? selected : active}
      tabIndex={0}
      title={rowTooltip(thread, dbUserId)}
      className={[
        "app-msg-row",
        active && !selectionMode ? "is-active" : "",
        thread.hasUnread ? "app-msg-row--unread" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={open}
      onKeyDown={onActivate(open)}
      data-dev-section="1"
      data-dev-section-key={`messages-thread-row-${thread.id}`}
      data-dev-section-type="content-card"
      data-dev-section-parent="messages-thread-list"
    >
      {selectionMode && (
        <input
          type="checkbox"
          className="app-toggle app-toggle--checkbox"
          checked={selected}
          onChange={() => onToggleSelect(thread.id)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${thread.title}`}
        />
      )}
      <span className="app-msg-row__title">{thread.title}</span>
      {thread.conversationType === "customer" ? (
        <span className="app-msg-tag app-msg-tag--external">Customer</span>
      ) : null}
      {thread.unreadMentionCount > 0 ? <span className="app-msg-tag app-msg-tag--accent">@</span> : null}
      <span className="app-msg-row__time">{formatListTimestamp(thread.lastMessage?.createdAt || thread.updatedAt)}</span>
      {thread.unreadCount > 0 ? (
        <span
          className="app-msg-row__count app-badge app-badge--danger-strong app-badge--count"
          aria-label={`${thread.unreadCount} unread`}
        >
          {unreadLabel(thread.unreadCount)}
        </span>
      ) : null}
    </div>
  );
}

// "——— PINNED ———": a caption between two separating lines.
function ListDivider({ label }) {
  return (
    <div className="app-msg-divider" role="separator" aria-label={label}>
      <span className="app-msg-divider__label">{label}</span>
    </div>
  );
}

function FeedRow({ title, preview, active, unread, onOpen }) {
  return (
    <div
      role="option"
      aria-selected={active}
      tabIndex={0}
      title={preview ? `${title}\n${preview}` : title}
      className={["app-msg-row", active ? "is-active" : "", unread ? "app-msg-row--unread" : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={onOpen}
      onKeyDown={onActivate(onOpen)}
    >
      <span className="app-msg-row__title">{title}</span>
      {unread ? (
        <span className="app-msg-row__count app-badge app-badge--danger-strong app-badge--count" aria-label="New">
          !
        </span>
      ) : null}
    </div>
  );
}

export default function ConversationList({
  threads = [],
  pinnedThreads = [],
  activeThreadId,
  activeSystemView,
  activeBookingsView,
  canSeeBookings,
  systemUnread,
  bookingsUnread,
  systemPreview,
  bookingsPreview,
  loading,
  dbUserId,
  searchTerm,
  onSearchChange,
  filter,
  onFilterChange,
  typeFilter,
  onTypeFilterChange,
  onOpenThread,
  onOpenSystem,
  onOpenBookings,
  onTogglePin,
  onNewConversation,
  selectionMode,
  selectedIds = [],
  onToggleSelect,
  onStartSelection,
  onCloseSelection,
  onDeleteSelected,
  deleteBusy,
  deleteError,
  onWebsiteHelpJoined,
  totalUnread = 0,
}) {
  const hasFilters = Boolean(searchTerm.trim()) || filter !== "all" || typeFilter !== "all";
  const showFeeds = !hasFilters;
  const activeFilterCount = (filter !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0);
  const isActive = (thread) => activeThreadId === thread.id && !activeSystemView && !activeBookingsView;

  return (
    <>
      <h2 className="app-msg-sr-only">
        Messages{totalUnread > 0 ? ` (${totalUnread} unread)` : ""}
      </h2>

      <div className="app-msg-list__toolbar">
        <SearchBar
          alwaysCollapse
          placeholder="Search conversations…"
          aria-label="Search conversations"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          onClear={() => onSearchChange("")}
        />
        <FilterButton
          title="Filter conversations"
          activeCount={activeFilterCount}
          onClear={() => {
            onFilterChange("all");
            onTypeFilterChange("all");
          }}
        >
          <FilterField label="Show">
            <TabGroup
              ariaLabel="Conversation filter"
              value={filter}
              onChange={onFilterChange}
              items={[
                { value: "all", label: "All" },
                { value: "unread", label: "Unread" },
                { value: "mentions", label: "@Me" },
              ]}
            />
          </FilterField>
          <FilterField label="Type">
            <DropdownField
              aria-label="Conversation type"
              value={typeFilter}
              options={TYPE_FILTER_OPTIONS}
              onValueChange={(value) => onTypeFilterChange(value)}
            />
          </FilterField>
        </FilterButton>
        <SymbolButton
          symbol="delete"
          label={selectionMode ? "Stop removing" : "Remove conversations"}
          aria-pressed={selectionMode}
          disabled={!selectionMode && !threads.length && !pinnedThreads.length}
          onClick={selectionMode ? onCloseSelection : onStartSelection}
        />
        <SymbolButton symbol="add" label="New conversation" onClick={onNewConversation} />
      </div>

      {selectionMode && (
        <div className="app-msg-list__selection">
          <span className="app-msg-muted">
            {selectedIds.length ? `${selectedIds.length} selected` : "Select conversations to remove"}
          </span>
          <span className="app-msg-anchor">
            <Button type="button" variant="danger" pill symbol={false} busy={deleteBusy} disabled={!selectedIds.length} onClick={onDeleteSelected}>
              Remove
            </Button>
            <Button type="button" variant="secondary" pill symbol={false} onClick={onCloseSelection}>
              Done
            </Button>
          </span>
        </div>
      )}
      {deleteError ? <StatusMessage tone="danger">{deleteError}</StatusMessage> : null}

      {showFeeds && pinnedThreads.length > 0 && <ListDivider label="Pinned" />}
      {showFeeds && pinnedThreads.length > 0 && (
        <div
          className="app-msg-pins"
          role="listbox"
          aria-label="Pinned conversations"
          data-count={pinnedThreads.length}
          data-dev-section="1"
          data-dev-section-key="messages-thread-pins"
          data-dev-section-type="toolbar"
        >
          {pinnedThreads.map((thread) => {
            const openPin = () => onOpenThread(thread.id, thread);
            return (
              <div
                key={thread.id}
                role="option"
                aria-selected={isActive(thread)}
                tabIndex={0}
                title={`${thread.title} — double-click to unpin`}
                className={`app-msg-pin${isActive(thread) ? " is-active" : ""}${thread.hasUnread ? " app-msg-row--unread" : ""}`}
                onClick={openPin}
                onDoubleClick={() => onTogglePin?.(thread.id)}
                onKeyDown={onActivate(openPin)}
              >
                <span className="app-msg-row__title">{thread.title}</span>
                {thread.unreadCount > 0 ? (
                  <span
                    className="app-msg-row__count app-badge app-badge--danger-strong app-badge--count"
                    aria-label={`${thread.unreadCount} unread`}
                  >
                    {unreadLabel(thread.unreadCount)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <ListDivider label="Conversations" />

      <div
        className="app-msg-list__scroll custom-scrollbar"
        role="listbox"
        aria-label="Conversations"
        data-presentation="messages-thread-list"
        data-dev-section="1"
        data-dev-section-key="messages-thread-list"
        data-dev-section-type="section-shell"
      >
        {showFeeds && (
          <>
            <FeedRow
              title="System notifications"
              preview={systemPreview}
              active={activeSystemView}
              unread={systemUnread}
              onOpen={onOpenSystem}
            />
            {canSeeBookings && (
              <FeedRow
                title="Bookings"
                preview={bookingsPreview}
                active={activeBookingsView}
                unread={bookingsUnread}
                onOpen={onOpenBookings}
              />
            )}
            {canSeeBookings && <WebsiteHelpQueue onJoined={onWebsiteHelpJoined} />}
          </>
        )}

        {loading ? (
          <RowsSkeleton />
        ) : (
          <>
            {hasFilters && (
              <span className="app-msg-list__group" role="presentation">
                {`${threads.length} result${threads.length === 1 ? "" : "s"}`}
              </span>
            )}
            {threads.map((thread) => (
              <ConversationRow
                key={thread.id}
                thread={thread}
                active={isActive(thread)}
                dbUserId={dbUserId}
                selectionMode={selectionMode}
                selected={selectedIds.includes(thread.id)}
                onOpen={(row) => onOpenThread(row.id, row)}
                onToggleSelect={onToggleSelect}
              />
            ))}
            {!threads.length && (
              <EmptyState
                variant="bare"
                role="status"
                title={hasFilters ? "No conversations match" : "No conversations yet"}
                description={
                  hasFilters
                    ? "Try another search or clear the filters."
                    : "Start a conversation with a colleague, a department or about a job."
                }
                action={
                  hasFilters ? null : (
                    <Button type="button" variant="primary" symbol={false} onClick={onNewConversation}>
                      New conversation
                    </Button>
                  )
                }
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
