// file location: src/components/page-ui/messages/messages-ui.js
//
// Presentation layer for /messages. All state, data and behaviour live in
// src/pages/messages/index.js; this file composes the workspace:
//
//   ┌ list ─────────┐┌ conversation ──────────────────┐┌ details ─────┐
//   │ search/filter ││ header · search · pinned bar   ││ Details      │
//   │ pinned feeds  ││ transcript                     ││ Files        │
//   │ conversations ││ composer (fixed at the bottom) ││ Links/Pinned │
//   └───────────────┘└────────────────────────────────┘└──────────────┘
//
// Styling is the messages family (src/styles/families/messages.css) plus the
// shared families it composes; panels are <LayerTheme> on the page card.
// No avatars or initials anywhere.

import React from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import SymbolButton from "@/components/ui/SymbolButton";
import InputField from "@/components/ui/InputField";
import StatusMessage from "@/components/ui/StatusMessage";
import EmptyState from "@/components/ui/EmptyState";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { SkeletonBlock, SkeletonKeyframes, InlineLoading } from "@/components/ui/LoadingSkeleton";
import ConversationList from "@/components/page-ui/messages/ConversationList";
import ConversationHeader from "@/components/page-ui/messages/ConversationHeader";
import ConversationDetails from "@/components/page-ui/messages/ConversationDetails";
import MessageComposer from "@/components/page-ui/messages/MessageComposer";
import MessageItem from "@/components/page-ui/messages/MessageItem";
import {
  COMMAND_GROUPS,
  DEPARTMENTS,
  formatDayLabel,
} from "@/lib/messages/conversationModel";

const GROUP_WINDOW_MS = 5 * 60 * 1000;

const NEW_CONVERSATION_MODES = [
  { value: "direct", label: "Direct" },
  { value: "group", label: "Group" },
  { value: "department", label: "Department" },
  { value: "job", label: "Job" },
  { value: "announcement", label: "Announcement" },
];

function FeedSkeleton() {
  return (
    <>
      <SkeletonKeyframes />
      {[62, 48, 70, 40].map((width, index) => (
        <div
          key={index}
          className={`app-msg-item${index % 2 ? " app-msg-item--mine" : ""}`}
          aria-hidden="true"
        >
          <div className="app-msg-bubble">
            <SkeletonBlock width={`${width * 4}px`} height="12px" />
            <SkeletonBlock width={`${width * 2}px`} height="10px" />
          </div>
        </div>
      ))}
    </>
  );
}

function Separator({ label, unread = false, innerRef }) {
  return (
    <div ref={innerRef} className={`app-msg-separator${unread ? " app-msg-separator--unread" : ""}`} role="separator">
      <span className="app-msg-separator__label">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// System / bookings feed (read only)
// ---------------------------------------------------------------------------
function SystemFeed({ feed, isMobileView, onBack }) {
  return (
    <>
      <header className="app-msg-header">
        <div className="app-msg-header__identity">
          {isMobileView && <SymbolButton symbol="back" label="Back to conversations" onClick={onBack} />}
          <div className="app-msg-header__text">
            <h2 className="app-msg-header__title">{feed.isBookings ? "Bookings" : "System notifications"}</h2>
            <div className="app-msg-header__meta">
              <span className="app-msg-tag">{feed.isBookings ? "Customer requests" : "System"} · read only</span>
              <span className="app-msg-muted">
                {feed.loading ? (
                  <InlineLoading width={140} label={feed.isBookings ? "Loading bookings" : "Loading updates"} />
                ) : (
                  `Latest ${feed.timestampLabel}`
                )}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="app-msg-feed custom-scrollbar" data-dev-section="1" data-dev-section-key="messages-system-feed" data-dev-section-type="section-shell">
        {feed.loading && <FeedSkeleton />}
        {!feed.loading && feed.error && <StatusMessage tone="danger">{feed.error}</StatusMessage>}
        {!feed.loading && !feed.error && feed.notes.length === 0 && (
          <EmptyState
            variant="bare"
            title={feed.isBookings ? "No booking requests" : "No system notifications"}
            description={feed.isBookings ? "Customer booking requests will appear here." : "Automated DMS alerts will appear here."}
          />
        )}
        {!feed.loading &&
          !feed.error &&
          feed.notes.map((note, index) => (
            <React.Fragment key={`system-${note.notification_id}`}>
              {feed.showUnread && feed.unreadIndex === index && (
                <Separator label="New" unread innerRef={feed.setUnreadEl} />
              )}
              <article className="app-msg-notice">
                {note.kind === "customer_request" ? (
                  <>
                    <div className="app-msg-notice__body">
                      <div>
                        <p className="app-msg-notice__title">{note.customer_name}</p>
                        <span className="app-msg-muted">{note.type_label}</span>
                      </div>
                      {note.vehicle_label ? <p className="app-msg-notice__title">{note.vehicle_label}</p> : null}
                      <p className="app-msg-notice__text">{note.description || ""}</p>
                      <div>
                        {note.preferred_date ? <p className="app-msg-notice__title">Preferred: {note.preferred_date}</p> : null}
                        <span className="app-msg-muted">{feed.formatTimestamp(note.created_at)}</span>
                      </div>
                    </div>
                    <Button type="button" variant="primary" pill symbol={false} onClick={() => feed.onCreateJob?.(note)}>
                      Create job
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="app-msg-notice__text">
                      {String(note.message || "System update").replace(/^[\s\p{Extended_Pictographic}️]+/u, "").trim() || "System update"}
                    </p>
                    <span className="app-msg-muted">{feed.formatTimestamp(note.created_at)}</span>
                  </>
                )}
              </article>
            </React.Fragment>
          ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------
function Transcript({ feed }) {
  const { messages } = feed;
  return (
    <div
      ref={feed.scrollerRef}
      className="app-msg-feed custom-scrollbar"
      aria-live="polite"
      aria-relevant="additions"
      data-dev-section="1"
      data-dev-section-key="messages-thread-feed"
      data-dev-section-type="section-shell"
    >
      {feed.loading && <FeedSkeleton />}
      {!feed.loading && messages.length === 0 && (
        <EmptyState
          variant="bare"
          title="No messages yet"
          description="Say hello, or type / to link a job, vehicle or customer."
        />
      )}
      {!feed.loading &&
        messages.map((message, index) => {
          const prev = index > 0 ? messages[index - 1] : null;
          const current = new Date(message.createdAt);
          const prevDate = prev ? new Date(prev.createdAt) : null;
          const sameDay = prevDate && prevDate.toDateString() === current.toDateString();
          const groupedWithPrev =
            prev &&
            sameDay &&
            prev.senderId === message.senderId &&
            !prev.metadata?.event &&
            !message.metadata?.event &&
            current - prevDate < GROUP_WINDOW_MS &&
            !(feed.showUnread && feed.unreadIndex === index);
          const member = feed.memberFor(message.senderId);
          const isExternal = String(member?.role || member?.profile?.role || message.sender?.role || "")
            .toLowerCase()
            .includes("customer");
          return (
            <React.Fragment key={message.id}>
              {!sameDay && <Separator label={formatDayLabel(message.createdAt)} />}
              {feed.showUnread && feed.unreadIndex === index && (
                <Separator label="New messages" unread innerRef={feed.setUnreadEl} />
              )}
              <MessageItem
                message={message}
                threadId={feed.threadId}
                isMine={message.senderId === feed.dbUserId}
                isExternal={isExternal}
                showMeta={!groupedWithPrev}
                senderLabel={message.sender?.name || member?.profile?.name || "Unknown"}
                senderRole={isExternal ? "Customer" : member?.profile?.jobTitle || ""}
                roles={feed.roles}
                currentUserId={feed.dbUserId}
                reactions={feed.reactions[message.id] || []}
                onReact={(emoji) => feed.onReact(message.id, emoji)}
                onReply={feed.onReply}
                onAction={feed.onAction}
                onJumpTo={feed.onJumpTo}
                actionBusy={feed.actionBusyId === message.id}
                receipt={feed.receiptFor(message)}
                highlighted={feed.highlightId === message.id}
                readOnly={feed.readOnly}
                leave={feed.leave}
                registerRef={feed.registerRef}
              />
            </React.Fragment>
          );
        })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Popups
// ---------------------------------------------------------------------------
function NewConversationModal({ modal }) {
  const {
    mode,
    onModeChange,
    directory,
    directoryLoading,
    directorySearch,
    onDirectorySearch,
    isSelected,
    onToggle,
    selected,
    onRemoveSelected,
    name,
    onNameChange,
    department,
    onDepartmentChange,
    includeDepartment,
    onIncludeDepartmentChange,
    jobNumber,
    onJobNumberChange,
    error,
    busy,
    canStart,
    onStart,
    onClose,
  } = modal;

  const needsPeople = mode === "direct" || mode === "group";
  return (
    <PopupModal
      isOpen
      onClose={onClose}
      ariaLabel="New conversation"
      cardClassName="app-settings-popup-card"
      cardStyle={{
        width: "min(100%, 680px)",
        maxHeight: "92vh",
        overflowY: "auto",
        padding: "var(--page-card-padding)",
      }}
    >
      <div className="app-msg-form">
        <header className="app-popup-compact-header">
          <h2>New conversation</h2>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </header>

        <TabGroup ariaLabel="Conversation type" value={mode} onChange={onModeChange} items={NEW_CONVERSATION_MODES} />

        {mode === "department" && (
          <>
            <StatusMessage tone="info">
              Each department has one standing chat. If it already exists you are added to it.
            </StatusMessage>
            <DropdownField
              label="Department"
              value={department}
              placeholder="Choose a department"
              options={DEPARTMENTS.map((entry) => ({ value: entry, label: entry }))}
              onValueChange={onDepartmentChange}
            />
          </>
        )}

        {mode === "job" && (
          <>
            <StatusMessage tone="info">
              An internal chat about one job card. Customers never see it — use the job card to message the customer.
            </StatusMessage>
            <InputField
              label="Job number"
              value={jobNumber}
              inputMode="numeric"
              placeholder="e.g. 24019"
              onChange={(event) => onJobNumberChange(event.target.value)}
            />
          </>
        )}

        {mode === "announcement" && (
          <>
            <StatusMessage tone="info">
              You lead the channel and can post; everyone else reads and reacts.
            </StatusMessage>
            <InputField label="Channel name" value={name} placeholder="e.g. Workshop notices" onChange={(event) => onNameChange(event.target.value)} />
            <DropdownField
              label="Audience department (optional)"
              value={department}
              options={[{ value: "", label: "No department" }, ...DEPARTMENTS.map((entry) => ({ value: entry, label: entry }))]}
              onValueChange={onDepartmentChange}
            />
          </>
        )}

        {(mode === "department" || (mode === "announcement" && department)) && (
          <label className="app-toggle-field">
            <input
              type="checkbox"
              className="app-toggle app-toggle--checkbox"
              checked={includeDepartment}
              onChange={(event) => onIncludeDepartmentChange(event.target.checked)}
            />
            <span>Add everyone in {department || "the department"}</span>
          </label>
        )}

        {mode === "group" && (
          <InputField label="Group name (optional)" value={name} placeholder="e.g. Saturday rota" onChange={(event) => onNameChange(event.target.value)} />
        )}

        <SearchBar
          placeholder={needsPeople ? "Search everyone…" : "Add people (optional)…"}
          value={directorySearch}
          onChange={(event) => onDirectorySearch(event.target.value)}
          onClear={() => onDirectorySearch("")}
        />

        <div className="app-msg-picker custom-scrollbar" role="listbox" aria-multiselectable={mode !== "direct"} aria-label="People">
          {directoryLoading && <InlineLoading width={180} label="Loading colleagues" />}
          {!directoryLoading && directory.length === 0 && <span className="app-msg-muted">No colleagues found.</span>}
          {!directoryLoading &&
            directory.map((entry) => {
              const picked = isSelected(entry);
              return (
                <div
                  key={entry.id}
                  role="option"
                  aria-selected={picked}
                  tabIndex={0}
                  className={`app-msg-entry app-msg-entry--clickable${picked ? " is-selected" : ""}`}
                  onClick={() => onToggle(entry)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onToggle(entry);
                    }
                  }}
                >
                  <span className="app-msg-entry__text">
                    <span className="app-msg-entry__primary">{entry.name}</span>
                    <span className="app-msg-entry__secondary">{entry.jobTitle || entry.role || "Team member"}</span>
                  </span>
                  {picked ? <span className="app-msg-tag">Selected</span> : null}
                </div>
              );
            })}
        </div>

        {selected.length > 0 && (
          <div className="app-msg-chips" aria-label="Selected people">
            {selected.map((entry) => (
              <Button
                key={entry.id}
                type="button"
                variant="secondary"
               
                pill
                symbol={false}
                aria-label={`Remove ${entry.name}`}
                onClick={() => onRemoveSelected(entry)}
              >
                {entry.name}
              </Button>
            ))}
          </div>
        )}

        {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}

        <div className="app-msg-list__selection">
          <span className="app-msg-muted">
            {mode === "direct"
              ? "Pick one person."
              : mode === "group"
                ? "Pick everyone who should be in the group."
                : "People are optional here."}
          </span>
          <Button type="button" variant="primary" symbol={false} busy={busy} disabled={!canStart} onClick={onStart}>
            Start conversation
          </Button>
        </div>
      </div>
    </PopupModal>
  );
}

// Slash-command help. Keeps the conventions of the staffglobal pass on this
// popup: compact header with the canonical secondary Close, StatusMessage tips
// and secondary Button rows.
function CommandHelpModal({ help }) {
  return (
    <PopupModal
      isOpen
      onClose={help.onClose}
      ariaLabel="Slash commands help"
      cardStyle={{
        width: "min(100%, 640px)",
        maxHeight: "86vh",
        overflowY: "auto",
        padding: "var(--section-card-padding)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--layout-card-gap)",
      }}
    >
      <header className="app-popup-compact-header">
        <h3>Slash commands</h3>
        <Button type="button" variant="secondary" onClick={help.onClose}>
          Close
        </Button>
      </header>

      <p style={{ margin: 0 }}>
        Commands link DMS records to the conversation and run quick actions. The ones shown depend on your role.
      </p>
      <StatusMessage tone="info">
        Click a command to insert it, or type / in the message box to see suggestions as you type.
      </StatusMessage>

      {COMMAND_GROUPS.map((group) => {
        const commands = help.commands.filter((cmd) => cmd.group === group.value);
        if (!commands.length) return null;
        return (
          <div key={group.value} style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <h4 style={{ margin: 0 }}>{group.label}</h4>
            {commands.map((cmd) => (
              <Button
                key={cmd.name}
                type="button"
                variant="secondary"
                symbol={false}
                onClick={() => help.onInsert(cmd)}
                style={{ width: "100%", justifyContent: "space-between", gap: "12px", minWidth: 0 }}
              >
                <strong style={{ whiteSpace: "nowrap" }}>{cmd.syntax}</strong>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {cmd.description}
                </span>
              </Button>
            ))}
          </div>
        );
      })}

      <StatusMessage tone="success">
        <strong>Smart linking:</strong> linking a job with /job also links its vehicle and customer to the
        conversation. Everything linked is listed under Details → Links.
      </StatusMessage>
      <StatusMessage tone="warning">
        <strong>Tip:</strong> a line that starts with /task, /remind, /assign, /status or /priority is an action —
        it changes the conversation instead of being sent as text.
      </StatusMessage>
    </PopupModal>
  );
}

function RenameModal({ rename }) {
  return (
    <PopupModal
      isOpen
      onClose={rename.onClose}
      ariaLabel="Rename conversation"
      cardStyle={{
        width: "min(100%, 520px)",
        padding: "var(--section-card-padding)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--layout-card-gap)",
      }}
    >
      <header className="app-popup-compact-header">
        <h3>Rename conversation</h3>
        <Button type="button" variant="secondary" onClick={rename.onClose}>
          Close
        </Button>
      </header>
      <InputField label="Name" value={rename.title} onChange={(event) => rename.onTitleChange(event.target.value)} />
      {rename.error ? <StatusMessage tone="danger">{rename.error}</StatusMessage> : null}
      <div className="app-msg-list__selection">
        <span />
        <Button type="button" variant="primary" symbol={false} busy={rename.busy} onClick={rename.onSave}>
          Save name
        </Button>
      </div>
    </PopupModal>
  );
}

function LeaveDeclineModal({ decline }) {
  return (
    <PopupModal
      isOpen
      onClose={decline.onClose}
      closeOnBackdrop={!decline.busy}
      closeOnEscape={!decline.busy}
      ariaLabel="Decline leave request"
      cardStyle={{
        width: "min(100%, 520px)",
        padding: "var(--section-card-padding)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--layout-card-gap)",
      }}
    >
      <header className="app-popup-compact-header">
        <h3>Decline leave request</h3>
        <Button type="button" variant="secondary" disabled={decline.busy} onClick={decline.onClose}>
          Close
        </Button>
      </header>
      <p style={{ margin: 0 }}>A reason is required before this request can be declined.</p>
      <textarea
        className="app-input"
        rows={4}
        value={decline.reason}
        onChange={(event) => decline.onReasonChange(event.target.value)}
        placeholder="Enter the reason for declining this request…"
      />
      {decline.error ? <StatusMessage tone="danger">{decline.error}</StatusMessage> : null}
      <div className="app-msg-list__selection">
        <span />
        <Button type="button" variant="danger" symbol={false} busy={decline.busy} onClick={decline.onConfirm}>
          Decline request
        </Button>
      </div>
    </PopupModal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function MessagesPageUi(props) {
  if (props.view === "section1") {
    return (
      <EmptyState variant="page" title="Please log in" description="Sign in to read and send internal messages." />
    );
  }

  const {
    isMobileView,
    mobilePanelView,
    onMobileBack,
    listProps,
    mode, // "system" | "bookings" | "thread" | "empty"
    systemFeed,
    headerProps,
    search,
    feed,
    composerProps,
    readOnlyNotice,
    conversationError,
    details,
    newConversation,
    help,
    rename,
    leaveDecline,
  } = props;

  const detailsOpen = Boolean(details?.open && mode === "thread");
  // Below the tablet breakpoint one panel shows at a time. Decided here, not
  // in CSS, because the layer primitives set their display inline.
  const showList = !isMobileView || mobilePanelView !== "conversation";
  const showConversation = !isMobileView || mobilePanelView === "conversation";

  return (
    <>
      <DevLayoutSection
        sectionKey="messages-page-shell"
        sectionType="page-shell"
        shell
        widthMode="page"
        className={`app-msg${detailsOpen ? " app-msg--details-open" : ""}`}
        data-mobile-view={isMobileView ? mobilePanelView : undefined}
      >
        <div className="app-msg__grid">
          {showList && (
            <div className="app-msg__slot app-msg__slot--list">
              <LayerTheme
                as="aside"
                className="app-msg__panel app-msg__list"
                sectionKey="messages-threads-panel"
                parentKey="messages-page-shell"
                sectionType="section-shell"
                aria-label="Conversations"
              >
                <ConversationList {...listProps} />
              </LayerTheme>
            </div>
          )}

          {showConversation && (
            <div className="app-msg__slot app-msg__slot--conversation">
              <LayerTheme
                as="section"
                className="app-msg__panel app-msg__conversation app-msg-convo"
                sectionKey="messages-conversation-panel"
                parentKey="messages-page-shell"
                sectionType="section-shell"
                data-presentation="messages-conversation"
                aria-label="Conversation"
              >
                {(mode === "system" || mode === "bookings") && (
                  <SystemFeed feed={systemFeed} isMobileView={isMobileView} onBack={onMobileBack} />
                )}

                {mode === "thread" && (
                  <>
                    <ConversationHeader {...headerProps} />

                    {search.open && (
                      <div className="app-msg-search" role="search">
                        <div className="app-msg-search__field">
                          <SearchBar
                            autoFocus
                            placeholder="Search this conversation"
                            value={search.term}
                            onChange={(event) => search.onChange(event.target.value)}
                            onClear={() => search.onChange("")}
                          />
                        </div>
                        <span className="app-msg-muted" aria-live="polite">
                          {search.term.trim()
                            ? search.matchCount
                              ? `${search.matchIndex + 1} of ${search.matchCount}`
                              : "No matches"
                            : ""}
                        </span>
                        <SymbolButton symbol="up" label="Previous match" disabled={!search.matchCount} onClick={search.onPrev} />
                        <SymbolButton symbol="down" label="Next match" disabled={!search.matchCount} onClick={search.onNext} />
                        <SymbolButton symbol="close" label="Close search" onClick={search.onClose} />
                      </div>
                    )}

                    <Transcript feed={feed} />

                    {conversationError ? <StatusMessage tone="danger">{conversationError}</StatusMessage> : null}

                    {readOnlyNotice ? (
                      <div className="app-msg-composer__notice" role="note">
                        <span>{readOnlyNotice}</span>
                      </div>
                    ) : (
                      <MessageComposer {...composerProps} />
                    )}
                  </>
                )}

                {mode === "empty" && (
                  <EmptyState
                    variant="page"
                    title="Select a conversation"
                    description="Pick a conversation on the left, or start a new one with a colleague, a department or about a job."
                    action={
                      <Button type="button" variant="primary" symbol={false} onClick={listProps.onNewConversation}>
                        New conversation
                      </Button>
                    }
                  />
                )}
              </LayerTheme>
            </div>
          )}

          {detailsOpen && (
            <div className="app-msg__slot app-msg__slot--details">
              <LayerTheme
                as="aside"
                className="app-msg__panel app-msg__details"
                sectionKey="messages-details-panel"
                parentKey="messages-page-shell"
                sectionType="section-shell"
                aria-label="Conversation details"
              >
                <ConversationDetails {...details.props} />
              </LayerTheme>
            </div>
          )}
        </div>
      </DevLayoutSection>

      {newConversation?.open && <NewConversationModal modal={newConversation} />}
      {help?.open && <CommandHelpModal help={help} />}
      {rename?.open && <RenameModal rename={rename} />}
      {leaveDecline?.open && <LeaveDeclineModal decline={leaveDecline} />}
    </>
  );
}
