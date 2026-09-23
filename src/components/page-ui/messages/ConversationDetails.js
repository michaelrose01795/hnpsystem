// file location: src/components/page-ui/messages/ConversationDetails.js
//
// The collapsible right-hand panel of an open conversation.
//
//   Details  about (type, department, job, created), workflow (status,
//            priority, owner), customer summary, members, notification
//            level, open tasks and reminders
//   Files    every file shared in the conversation
//   Links    DMS records linked to the conversation + web links in messages
//   Pinned   pinned messages; click to jump, or unpin
//
// People are listed by name, role and presence — no avatars or initials.

import React, { useMemo } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import SymbolButton from "@/components/ui/SymbolButton";
import StatusMessage from "@/components/ui/StatusMessage";
import EmptyState from "@/components/ui/EmptyState";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";
import NewsAttachments from "@/components/NewsFeed/NewsAttachments";
import { buildAttachmentUrl } from "@/lib/api/messages";
import {
  NOTIFICATION_LEVELS,
  PRIORITIES,
  STATUSES,
  formatDueLabel,
  formatListTimestamp,
  getConversationType,
  getLinkType,
  flattenMentions,
  resolveLinkHref,
  typeSupportsWorkflow,
} from "@/lib/messages/conversationModel";

const URL_PATTERN = /https?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g;

function Section({ title, count, action, children }) {
  return (
    <section className="app-msg-section">
      <h4 className="app-msg-section__title">
        <span>
          {title}
          {typeof count === "number" ? ` (${count})` : ""}
        </span>
        {action}
      </h4>
      {children}
    </section>
  );
}

function RecordLinks({ links, onRemove }) {
  if (!links.length) return null;
  return (
    <ul className="app-news-links">
      {links.map((link) => {
        const type = getLinkType(link.recordType);
        const href = resolveLinkHref(link);
        return (
          <li key={`${link.recordType}:${link.recordId}`} className="app-news-link-row">
            {href ? (
              <Link className="app-news-link" href={href} title={link.label}>
                <span className="app-news-link__type">{type?.label || "Record"}</span>
                <span className="app-news-link__label">{link.label}</span>
              </Link>
            ) : (
              <span className="app-news-link">
                <span className="app-news-link__type">{type?.label || "Record"}</span>
                <span className="app-news-link__label">{link.label}</span>
              </span>
            )}
            {onRemove && (
              <SymbolButton
                symbol="close"
                label={`Unlink ${link.label}`}
               
                onClick={() => onRemove(link)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function ConversationDetails({
  thread,
  tab,
  onTabChange,
  onClose,
  messages = [],
  dbUserId,
  presenceFor,
  customerDetail,
  // settings
  onUpdateSettings,
  settingsBusy,
  settingsError,
  // members
  canManageMembers,
  groupLeaderCount,
  groupSearchTerm,
  onGroupSearchChange,
  groupSearchResults = [],
  groupSearchLoading,
  onAddMember,
  onRemoveMember,
  groupManageBusy,
  groupManageError,
  // messages
  onJumpToMessage,
  onMessageAction,
  actionBusy,
}) {
  const type = getConversationType(thread?.conversationType);
  const workflow = typeSupportsWorkflow(thread?.conversationType);
  const members = thread?.members || [];

  const files = useMemo(
    () =>
      messages
        .filter((message) => !message.metadata?.deleted)
        .flatMap((message) =>
          (message.metadata?.attachments || []).map((file) => ({
            id: file.path,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            isImage: Boolean(file.isImage),
            downloadUrl: buildAttachmentUrl(thread?.id, file.path),
          }))
        )
        .reverse(),
    [messages, thread?.id]
  );

  const webLinks = useMemo(() => {
    const seen = new Set();
    const out = [];
    [...messages].reverse().forEach((message) => {
      if (message.metadata?.deleted) return;
      for (const match of String(message.content || "").matchAll(URL_PATTERN)) {
        if (seen.has(match[0])) continue;
        seen.add(match[0]);
        out.push({ url: match[0], by: message.sender?.name || "", at: message.createdAt });
      }
    });
    return out;
  }, [messages]);

  const pinned = useMemo(
    () => messages.filter((message) => message.metadata?.pinned && !message.metadata?.deleted).reverse(),
    [messages]
  );

  const openItems = useMemo(
    () =>
      messages.filter((message) => {
        const meta = message.metadata || {};
        if (meta.deleted) return false;
        return (meta.task && meta.task.status !== "done") || (meta.reminder && meta.reminder.status !== "done");
      }),
    [messages]
  );

  const linkedRecords = thread?.linkedRecords || [];
  const tabs = [
    { value: "details", label: "Details" },
    { value: "files", label: `Files${files.length ? ` ${files.length}` : ""}` },
    { value: "links", label: `Links${linkedRecords.length + webLinks.length ? ` ${linkedRecords.length + webLinks.length}` : ""}` },
    { value: "pinned", label: `Pinned${pinned.length ? ` ${pinned.length}` : ""}` },
  ];

  const hubMissing = thread && !thread.hubReady;

  return (
    <>
      <div className="app-msg-details__head">
        <h3 className="app-msg-details__title">Conversation details</h3>
        <SymbolButton symbol="close" label="Close details" onClick={onClose} />
      </div>

      <TabGroup ariaLabel="Conversation details" value={tab} onChange={onTabChange} items={tabs} />

      <div className="app-msg-details__scroll custom-scrollbar">
        {tab === "details" && (
          <>
            <Section title="About">
              <dl className="app-msg-facts">
                <dt>Type</dt>
                <dd>{type.external ? "Customer (external)" : `${type.label} (internal)`}</dd>
                {thread?.department ? (
                  <>
                    <dt>Department</dt>
                    <dd>{thread.department}</dd>
                  </>
                ) : null}
                {thread?.jobNumber ? (
                  <>
                    <dt>Job</dt>
                    <dd>
                      <Link className="app-msg-ref" href={`/job-cards/${encodeURIComponent(thread.jobNumber)}`}>
                        Job {thread.jobNumber}
                      </Link>
                    </dd>
                  </>
                ) : null}
                <dt>Started</dt>
                <dd>{thread?.createdAt ? new Date(thread.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Unknown"}</dd>
                {thread?.assigneeName ? (
                  <>
                    <dt>Owner</dt>
                    <dd>{thread.assigneeName}</dd>
                  </>
                ) : null}
              </dl>
            </Section>

            {workflow && (
              <Section title="Workflow">
                {hubMissing ? (
                  <StatusMessage tone="info">
                    Status, priority and owner become available once the conversation-hub migration has been run.
                  </StatusMessage>
                ) : (
                  <>
                    <DropdownField
                      label="Status"
                      value={thread.status}
                      disabled={settingsBusy}
                      options={STATUSES.map((entry) => ({ value: entry.value, label: entry.label }))}
                      onValueChange={(value) => onUpdateSettings({ status: value })}
                    />
                    <DropdownField
                      label="Priority"
                      value={thread.priority}
                      disabled={settingsBusy}
                      options={PRIORITIES.map((entry) => ({ value: entry.value, label: entry.label }))}
                      onValueChange={(value) => onUpdateSettings({ priority: value })}
                    />
                    <DropdownField
                      label="Owner"
                      value={thread.assignedTo ? String(thread.assignedTo) : ""}
                      disabled={settingsBusy}
                      options={[
                        { value: "", label: "No owner" },
                        ...members
                          .filter((member) => !String(member.role || "").includes("customer"))
                          .map((member) => ({
                            value: String(member.userId),
                            label: member.profile?.name || "Member",
                          })),
                      ]}
                      onValueChange={(value) => onUpdateSettings({ assignedTo: value ? Number(value) : null })}
                    />
                  </>
                )}
                {settingsError ? <StatusMessage tone="danger">{settingsError}</StatusMessage> : null}
              </Section>
            )}

            {type.value === "customer" && customerDetail ? (
              <Section title="Customer">
                <dl className="app-msg-facts">
                  <dt>Name</dt>
                  <dd>{customerDetail.name}</dd>
                  {customerDetail.phone ? (
                    <>
                      <dt>Phone</dt>
                      <dd>
                        <a className="app-msg-url" href={`tel:${customerDetail.phone}`}>{customerDetail.phone}</a>
                      </dd>
                    </>
                  ) : null}
                  {customerDetail.vehicle ? (
                    <>
                      <dt>Vehicle</dt>
                      <dd>{customerDetail.vehicle}</dd>
                    </>
                  ) : null}
                  {customerDetail.jobNumber ? (
                    <>
                      <dt>Latest job</dt>
                      <dd>
                        <Link className="app-msg-ref" href={`/job-cards/${encodeURIComponent(customerDetail.jobNumber)}`}>
                          Job {customerDetail.jobNumber}
                        </Link>
                      </dd>
                    </>
                  ) : null}
                </dl>
              </Section>
            ) : null}

            {linkedRecords.length > 0 && (
              <Section title="Linked records" count={linkedRecords.length}>
                <RecordLinks links={linkedRecords} />
              </Section>
            )}

            <Section title="Members" count={members.length}>
              <div className="app-msg-options">
                {members.map((member) => {
                  const isSelf = member.userId === dbUserId;
                  const isCustomer = String(member.role || member.profile?.role || "").toLowerCase().includes("customer");
                  const presence = presenceFor?.(member);
                  const canRemove =
                    canManageMembers &&
                    !isSelf &&
                    !(member.role === "leader" && groupLeaderCount <= 1);
                  return (
                    <div key={member.userId} className="app-msg-entry">
                      <span className="app-msg-entry__text">
                        <span className="app-msg-entry__primary">
                          {member.profile?.name || "Unknown"}
                          {isSelf ? " (you)" : ""}
                        </span>
                        <span className="app-msg-entry__secondary">
                          {[
                            isCustomer ? "Customer" : member.profile?.jobTitle || member.profile?.role,
                            member.role === "leader" ? "Leader" : null,
                            !isSelf && presence?.text ? presence.text : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {canRemove && (
                        <span className="app-msg-entry__actions">
                          <Button
                            type="button"
                            variant="danger"
                           
                            pill
                            symbol={false}
                            disabled={groupManageBusy}
                            onClick={() => onRemoveMember(member.userId)}
                          >
                            Remove
                          </Button>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {canManageMembers && (
                <>
                  <SearchBar
                    placeholder="Add a colleague (min 2 letters)"
                    value={groupSearchTerm}
                    onChange={(event) => onGroupSearchChange(event.target.value)}
                    onClear={() => onGroupSearchChange("")}
                  />
                  {groupSearchLoading && <InlineLoading width={160} label="Looking up colleagues" />}
                  {!groupSearchLoading &&
                    groupSearchResults.map((entry) => (
                      <div key={entry.id} className="app-msg-entry">
                        <span className="app-msg-entry__text">
                          <span className="app-msg-entry__primary">{entry.name}</span>
                          <span className="app-msg-entry__secondary">{entry.jobTitle || entry.role || "Team member"}</span>
                        </span>
                        <Button
                          type="button"
                          variant="primary"
                         
                          pill
                          symbol={false}
                          disabled={groupManageBusy}
                          onClick={() => onAddMember(entry.id)}
                        >
                          Add
                        </Button>
                      </div>
                    ))}
                  {!groupSearchLoading && groupSearchTerm.trim().length >= 2 && !groupSearchResults.length && (
                    <span className="app-msg-muted">No colleagues match that search.</span>
                  )}
                  {groupManageError ? <StatusMessage tone="danger">{groupManageError}</StatusMessage> : null}
                </>
              )}
            </Section>

            <Section title="Notifications">
              {hubMissing ? (
                <StatusMessage tone="info">
                  Per-conversation notification settings become available once the conversation-hub migration has been run.
                </StatusMessage>
              ) : (
                <div className="app-msg-options" role="radiogroup" aria-label="Notifications for this conversation">
                  {NOTIFICATION_LEVELS.map((level) => (
                    <label key={level.value} className="app-toggle-field">
                      <input
                        type="radio"
                        className="app-toggle app-toggle--radio"
                        name={`notify-${thread?.id}`}
                        value={level.value}
                        checked={thread?.notificationLevel === level.value}
                        disabled={settingsBusy}
                        onChange={() => onUpdateSettings({ notificationLevel: level.value })}
                      />
                      <span>
                        <strong>{level.label}</strong>
                        <span className="app-msg-muted"> · {level.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Open tasks & reminders" count={openItems.length}>
              {openItems.length ? (
                <div className="app-msg-options">
                  {openItems.map((message) => {
                    const meta = message.metadata || {};
                    const isReminder = Boolean(meta.reminder);
                    const data = meta.reminder || meta.task;
                    const overdue = isReminder && data.dueAt && new Date(data.dueAt).getTime() < Date.now();
                    return (
                      <div key={message.id} className="app-msg-entry">
                        <span
                          className="app-msg-entry__text"
                          role="link"
                          tabIndex={0}
                          onClick={() => onJumpToMessage(message.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") onJumpToMessage(message.id);
                          }}
                        >
                          <span className="app-msg-entry__primary">{data.text}</span>
                          <span className={`app-msg-entry__secondary${overdue ? " app-msg-tag--danger" : ""}`}>
                            {isReminder ? `Reminder · due ${formatDueLabel(data.dueAt)}${overdue ? " (overdue)" : ""}` : `Task · ${message.sender?.name || ""}`}
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="primary"
                         
                          pill
                          symbol={false}
                          disabled={actionBusy}
                          onClick={() => onMessageAction(message, isReminder ? "reminder-done" : "task-done")}
                        >
                          Done
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="app-msg-muted">Nothing open. Add one with /task or /remind.</span>
              )}
            </Section>
          </>
        )}

        {tab === "files" &&
          (files.length ? (
            <NewsAttachments attachments={files} />
          ) : (
            <EmptyState variant="bare" title="No files yet" description="Files you attach to messages collect here." />
          ))}

        {tab === "links" && (
          <>
            <Section title="Linked DMS records" count={linkedRecords.length}>
              {linkedRecords.length ? (
                <RecordLinks
                  links={linkedRecords}
                  onRemove={thread?.hubReady ? (link) => onUpdateSettings({ removeLinks: [link] }) : null}
                />
              ) : (
                <span className="app-msg-muted">
                  Link a record with /job, /reg, /cust, /part, /appt or /invoice.
                </span>
              )}
            </Section>
            <Section title="Web links" count={webLinks.length}>
              {webLinks.length ? (
                <div className="app-msg-options">
                  {webLinks.map((entry) => (
                    <div key={entry.url} className="app-msg-entry">
                      <span className="app-msg-entry__text">
                        <a className="app-msg-url app-msg-entry__primary" href={entry.url} target="_blank" rel="noreferrer noopener">
                          {entry.url}
                        </a>
                        <span className="app-msg-entry__secondary">
                          {entry.by} · {formatListTimestamp(entry.at)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="app-msg-muted">Web addresses shared in messages appear here.</span>
              )}
            </Section>
          </>
        )}

        {tab === "pinned" &&
          (pinned.length ? (
            <div className="app-msg-options">
              {pinned.map((message) => (
                <div
                  key={message.id}
                  className="app-msg-entry app-msg-entry--clickable"
                  role="link"
                  tabIndex={0}
                  onClick={() => onJumpToMessage(message.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onJumpToMessage(message.id);
                  }}
                >
                  <span className="app-msg-entry__text">
                    <span className="app-msg-entry__secondary">
                      {message.sender?.name || "Unknown"} · {formatListTimestamp(message.createdAt)}
                      {message.metadata?.pinned?.byName ? ` · pinned by ${message.metadata.pinned.byName}` : ""}
                    </span>
                    <span className="app-msg-entry__primary">{flattenMentions(message.content)}</span>
                  </span>
                  <span className="app-msg-entry__actions" onClick={(event) => event.stopPropagation()}>
                    <SymbolButton
                      symbol="close"
                      label="Unpin message"
                     
                      disabled={actionBusy}
                      onClick={() => onMessageAction(message, "unpin")}
                    />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              variant="bare"
              title="Nothing pinned"
              description="Pin an important message from its actions to keep it here."
            />
          ))}
      </div>
    </>
  );
}
