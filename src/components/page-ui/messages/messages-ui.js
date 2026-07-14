// file location: src/components/page-ui/messages/messages-ui.js

import React from "react"; // support extracted fragments.

export default function MessagesPageUi(props) {
  const {
    Button,
    Chip,
    ColleagueRowsSkeleton,
    ComposeToggleButton,
    DevLayoutSection,
    InlineLoading,
    InputField,
    MessageBubble,
    MessageBubblesSkeleton,
    ModalPortal,
    SearchBar,
    StatusMessage,
    ThreadRowsSkeleton,
    activeBookingsView,
    activeSystemView,
    activeThread,
    activeThreadId,
    activeThreadUnreadMarkerIndex,
    availableCommands,
    canEditGroup,
    canInitiateChat,
    canSend,
    canSeeCustomerRequests,
    cardStyle,
    closeGroupEditModal,
    closeNewChatModal,
    commandHelpOpen,
    commandSuggestions,
    composeError,
    composeMode,
    conversationError,
    customerDetail,
    dbUserId,
    messageFilter = "all",
    handleSelectMessageFilter,
    directory,
    directoryLoading,
    directorySearch,
    filteredThreads,
    formatNotificationTimestamp,
    groupEditBusy,
    groupEditError,
    groupEditModalOpen,
    groupEditTitle,
    groupLeaderCount,
    groupManageBusy,
    groupManageError,
    groupMembersModalOpen,
    groupName,
    groupSearchLoading,
    groupSearchResults,
    groupSearchTerm,
    handleAddMemberToGroup,
    handleApproveLeaveRequest,
    handleCloseSelectionMode,
    handleConfirmDeclineLeaveRequest,
    handleDeleteSelectedThreads,
    handleDirectoryUser,
    handleInsertCommandFromHelp,
    handleMessageDraftChange,
    handleMobileBack,
    handleOpenDeclineLeaveRequest,
    handleOpenNewChatModal,
    handleRemoveMemberFromGroup,
    handleSaveGroupDetails,
    handleSelectCommand,
    handleSendMessage,
    handleStartChat,
    handleThreadCheckboxChange,
    handleTogglePinnedThread,
    hasBookingsUnread,
    hasSystemUnread,
    isGroupChat,
    isGroupLeader,
    isMobileView,
    isRecipientSelected,
    leaveDecisionBusy,
    leaveDecisionError,
    leaveDeclineModal,
    leaveDeclineReason,
    loadingMessages,
    loadingThreads,
    messageDraft,
    messageReactions,
    messages,
    mobilePanelView,
    newChatModalOpen,
    openBookingsThread,
    openGroupEditModal,
    openThread,
    orderedSystemNotifications,
    handleCreateJobFromRequest,
    palette,
    pinnedThreads = [],
    radii,
    replyTo,
    scrollerRef,
    selectedRecipients,
    selectedThreadIds,
    sending,
    setCommandHelpOpen,
    setComposeError,
    setComposeMode,
    setDirectorySearch,
    setGroupEditTitle,
    setGroupMembersModalOpen,
    setGroupName,
    setGroupSearchTerm,
    setLeaveDecisionError,
    setLeaveDeclineModal,
    setLeaveDeclineReason,
    setMessageReactions,
    setReplyTo,
    setSelectedRecipients,
    setSelectedThreadIds,
    setSystemUnreadMarkerEl,
    setThreadSearchTerm,
    setThreadSelectionMode,
    setThreadUnreadMarkerEl,
    shadows,
    showCommandSuggestions,
    showSystemUnreadMarker,
    showThreadUnreadMarker,
    systemError,
    systemLoading,
    systemTimestampLabel,
    systemTitleColor,
    systemUnreadMarkerIndex,
    threadDeleteBusy,
    threadDeleteError,
    threadSearchTerm,
    threadSelectionMode,
    user,
    userNameColor,
    visibleThreads,
  } = props; // receive page logic props.
  const isCustomerChat = Boolean(
    isGroupChat &&
    activeThread?.members?.some((member) =>
      String(member?.role || "").toLowerCase().includes("customer")
    )
  );
  // True for any thread that has a customer member, regardless of thread type —
  // drives the customer summary line in the thread header.
  const headerHasCustomerMember = Boolean(
    activeThread?.members?.some((member) =>
      String(member?.role || member?.profile?.role || "")
        .toLowerCase()
        .includes("customer")
    )
  );
  // The 5 left-bar category filters. "system" opens the read-only system view.
  const MESSAGE_FILTERS = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread" },
    { key: "customer", label: "Customer" },
    { key: "team", label: "Team" },
    { key: "system", label: "System" },
  ];

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <div style={{
  padding: "var(--space-2xl)",
  textAlign: "center"
}}>
        <h2>Please log in to access internal messages.</h2>
      </div>; // render extracted page section.

    case "section2":
      return <>
      <DevLayoutSection sectionKey="messages-page-shell" sectionType="page-shell" shell widthMode="page" className="app-page-stack" style={{
    height: "100%",
    minHeight: isMobileView ? "100%" : 0,
    overflow: "hidden"
  }}>
        <DevLayoutSection sectionKey="messages-top-bar" parentKey="messages-page-shell" sectionType="filter-row" style={{
      display: isMobileView && mobilePanelView === "conversation" ? "none" : "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--space-sm)",
      flexWrap: "wrap",
      flex: "0 0 auto"
    }}>
          {/* Left: category filter pills */}
          <div style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-1)",
        flexWrap: "wrap",
        minWidth: 0
      }}>
            {MESSAGE_FILTERS.map(item => {
          const active = item.key === "system"
            ? activeSystemView
            : messageFilter === item.key && !activeSystemView && !activeBookingsView;
          return <button key={item.key} type="button" className={`app-btn app-btn--${active ? "primary" : "secondary"} app-btn--pill`} onClick={() => handleSelectMessageFilter?.(item.key)} style={{
            height: "44px",
            minWidth: 0
          }}>
                {item.label}
                {item.key === "system" && hasSystemUnread && <span aria-label="Unread system messages" style={{
              width: "var(--space-sm)",
              height: "var(--space-sm)",
              borderRadius: "var(--radius-full)",
              backgroundColor: "currentColor",
              display: "inline-block",
              marginLeft: "var(--space-1)",
              flex: "0 0 auto"
            }} />}
              </button>;
        })}
          </div>

          {/* Right: search + select/remove + add */}
          <div style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)",
        flex: "1 1 320px",
        justifyContent: "flex-end",
        minWidth: 0
      }}>
            <div style={{
          flex: "1 1 auto",
          minWidth: 0,
          maxWidth: "360px"
        }}>
              <SearchBar placeholder="Search messages..." value={threadSearchTerm} onChange={event => setThreadSearchTerm(event.target.value)} onClear={() => setThreadSearchTerm("")} style={{
            width: "100%",
            margin: 0
          }} />
            </div>
            {threadSelectionMode ? <>
                <span style={{
            color: "var(--text-2)",
            fontSize: "var(--text-small)",
            fontWeight: 700,
            whiteSpace: "nowrap"
          }}>
                  {selectedThreadIds.length ? `${selectedThreadIds.length} selected` : "Select threads"}
                </span>
                <Button type="button" variant="danger" size="sm" pill onClick={handleDeleteSelectedThreads} disabled={threadDeleteBusy || !selectedThreadIds.length}>
                  {threadDeleteBusy ? "Removing..." : "Remove"}
                </Button>
                <Button type="button" variant="secondary" size="sm" pill onClick={handleCloseSelectionMode}>
                  Close
                </Button>
              </> : <>
                <Button type="button" variant="secondary" size="sm" pill onClick={() => {
            if (!visibleThreads.length) return;
            setThreadSelectionMode(true);
            setSelectedThreadIds([]);
          }} disabled={!visibleThreads.length}>
                  Select
                </Button>
                <Button type="button" variant="primary" size="sm" pill onClick={handleOpenNewChatModal} aria-label="Start new chat">
                  +
                </Button>
              </>}
          </div>
        </DevLayoutSection>

        <DevLayoutSection sectionKey="messages-main-layout" parentKey="messages-page-shell" sectionType="section-shell" shell style={{
      flex: 1,
      height: "100%",
      display: isMobileView ? "flex" : "grid",
      // flex on mobile for single-panel view
      flexDirection: isMobileView ? "column" : undefined,
      gridTemplateColumns: isMobileView ? undefined : "360px minmax(0, 1fr)",
      gap: isMobileView ? "0px" : "20px",
      minHeight: 0,
      overflow: "hidden"
    }}>
          <DevLayoutSection sectionKey="messages-threads-panel" parentKey="messages-main-layout" sectionType="section-shell" shell backgroundToken="messages-threads-panel" style={{
        display: isMobileView && mobilePanelView === "conversation" ? "none" : "flex",
        // hide thread list on mobile when viewing a conversation
        flexDirection: "column",
        gap: "18px",
        flex: 1,
        minHeight: 0,
        ...(isMobileView ? {
          height: "100%"
        } : {})
      }}>
            <DevLayoutSection sectionKey="messages-threads-card" parentKey="messages-threads-panel" sectionType="content-card" backgroundToken="messages-thread-card-shell" style={{
          ...cardStyle,
          background: "var(--theme)",
          flex: 1,
          minHeight: 0,
          overflow: "hidden"
        }}>
              {threadDeleteError && <StatusMessage tone="danger">{threadDeleteError}</StatusMessage>}

              <DevLayoutSection data-presentation="messages-thread-list" sectionKey="messages-thread-list" parentKey="messages-threads-card" sectionType="section-shell" shell backgroundToken="messages-thread-list" className="custom-scrollbar" style={{
            flex: 1,
            minHeight: 0,
            maxHeight: "none",
            // fill available space on mobile
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            paddingTop: "6px",
            paddingBottom: "6px",
            paddingRight: "2px",
            userSelect: "none",
            WebkitUserSelect: "none"
          }}>
                <DevLayoutSection sectionKey="messages-thread-pins" parentKey="messages-thread-list" sectionType="toolbar" style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "var(--space-sm)",
              width: "100%",
              flex: "0 0 auto"
            }}>
                  {canSeeCustomerRequests && <button type="button" className={`app-btn app-btn--${activeBookingsView ? "primary" : "secondary"} app-btn--pill`} onClick={openBookingsThread} style={{
                width: "100%",
                height: "44px",
                minWidth: 0,
                justifyContent: "center",
                overflow: "hidden"
              }}>
                    <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-1)",
                  minWidth: 0
                }}>
                      <span style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>
                        Bookings
                      </span>
                      {hasBookingsUnread && <span aria-label="Unread booking messages" style={{
                    width: "var(--space-sm)",
                    height: "var(--space-sm)",
                    borderRadius: "var(--radius-full)",
                    backgroundColor: "currentColor",
                    display: "inline-block",
                    flex: "0 0 auto"
                  }} />}
                    </span>
                  </button>}
                  {pinnedThreads.map(thread => <button key={`pin-${thread.id}`} type="button" className={`app-btn app-btn--${activeThreadId === thread.id && !activeSystemView && !activeBookingsView ? "primary" : "secondary"} app-btn--pill app-hover-tooltip`} data-tooltip={thread.title} onClick={() => openThread(thread.id, thread)} onDoubleClick={() => handleTogglePinnedThread(thread.id)} aria-label={thread.title} style={{
                width: "100%",
                height: "44px",
                minWidth: 0,
                justifyContent: "center",
                overflow: "visible"
              }}>
                      <span style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0
                }}>
                        {thread.title}
                      </span>
                      {thread.hasUnread && <span aria-label="Unread messages" style={{
                  width: "var(--space-sm)",
                  height: "var(--space-sm)",
                  borderRadius: "var(--radius-full)",
                  backgroundColor: "currentColor",
                  display: "inline-block",
                  flex: "0 0 auto",
                  marginLeft: "var(--space-1)"
                }} />}
                    </button>)}
                  {(() => {
                // Keep the 3-column grid aligned: pad the final row with spacers.
                // Quick buttons = optional Bookings + up to 3 pinned chats.
                const quickCount = (canSeeCustomerRequests ? 1 : 0) + pinnedThreads.length;
                const spacerCount = quickCount === 0 ? 0 : (3 - (quickCount % 3)) % 3;
                return Array.from({ length: spacerCount }).map((_, index) => <span key={`pin-empty-${index}`} aria-hidden="true" />);
              })()}
                </DevLayoutSection>
                {loadingThreads && <ThreadRowsSkeleton count={5} />}
                {!loadingThreads && <>
                    {filteredThreads.length ? <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                userSelect: "none",
                WebkitUserSelect: "none"
              }}>
                        {filteredThreads.map(thread => <div key={thread.id} data-dev-section="1" data-dev-section-key={`messages-thread-row-${thread.id}`} data-dev-section-type="section-shell" data-dev-section-parent="messages-thread-list" data-dev-background-token="messages-thread-row" onMouseDown={event => {
                  if (!threadSelectionMode && event.detail > 1) {
                    event.preventDefault();
                  }
                }} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  userSelect: "none",
                  WebkitUserSelect: "none"
                }}>
                            {threadSelectionMode && <input type="checkbox" checked={selectedThreadIds.includes(thread.id)} onChange={() => handleThreadCheckboxChange(thread.id)} style={{
                    width: "16px",
                    height: "16px",
                    cursor: "pointer"
                  }} />}
                            <div role="button" tabIndex={threadSelectionMode ? -1 : 0} aria-disabled={threadSelectionMode} onClick={() => threadSelectionMode ? null : openThread(thread.id, thread)} onMouseDown={event => {
                    if (!threadSelectionMode && event.detail > 1) {
                      event.preventDefault();
                    }
                  }} onKeyDown={event => {
                    if (threadSelectionMode) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openThread(thread.id, thread);
                    }
                  }} onDoubleClick={() => threadSelectionMode ? null : handleTogglePinnedThread(thread.id)} title={threadSelectionMode ? undefined : "Double click to pin"} data-dev-section="1" data-dev-section-key={`messages-thread-card-${thread.id}`} data-dev-section-type="content-card" data-dev-section-parent={`messages-thread-row-${thread.id}`} data-dev-background-token={activeThreadId === thread.id ? "messages-thread-card-active" : thread.hasUnread ? "messages-thread-card-unread" : "messages-thread-card"} style={{
                    flex: 1,
                    height: "44px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: activeThreadId === thread.id ? "rgba(var(--accent-purple-rgb), 0.12)" : "var(--surface)",
                    padding: "0 12px",
                    textAlign: "left",
                    cursor: threadSelectionMode ? "default" : "pointer",
                    boxShadow: activeThreadId === thread.id ? `inset 4px 0 0 ${palette.accent}` : "none",
                    transition: "background-color 0.16s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    minWidth: 0,
                    userSelect: "none",
                    WebkitUserSelect: "none"
                  }} onMouseEnter={event => {
                    if (threadSelectionMode || activeThreadId === thread.id) return;
                    event.currentTarget.style.backgroundColor = "var(--surface)";
                  }} onMouseLeave={event => {
                    if (threadSelectionMode || activeThreadId === thread.id) return;
                    event.currentTarget.style.backgroundColor = "var(--surface)";
                  }}>
                              <strong style={{
                      display: "block",
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "var(--text-body)",
                      fontWeight: activeThreadId === thread.id ? 800 : 700,
                      color: systemTitleColor
                    }}>
                                {thread.title}
                              </strong>
                              {thread.hasUnread && <span style={{
                      width: "18px",
                      height: "18px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "var(--radius-full)",
                      backgroundColor: palette.accent,
                      color: "var(--surface)",
                      fontSize: "10px",
                      fontWeight: 700,
                      flex: "0 0 auto"
                    }} aria-label="Unread messages">
                                  !
                                </span>}
                            </div>
                          </div>)}
                      </div> : <p style={{
                color: palette.textMuted,
                margin: 0
              }}>
                        {threadSearchTerm.trim() ? "No threads match your search." : "No conversations yet. Start one above."}
                      </p>}
                  </>}
              </DevLayoutSection>
            </DevLayoutSection>
          </DevLayoutSection>

          <DevLayoutSection data-presentation="messages-conversation" sectionKey="messages-conversation-panel" parentKey="messages-main-layout" sectionType="section-shell" shell backgroundToken="messages-conversation-panel" style={{
        ...cardStyle,
        background: "var(--theme)",
        flex: 1,
        minHeight: 0,
        flexDirection: "column",
        overflow: "hidden",
        display: isMobileView && mobilePanelView !== "conversation" ? "none" : "flex" // hide conversation panel when thread list is active in portrait phone view
      }}>
            {/* Mobile back button — iPhone-style navigation */}
            {isMobileView && mobilePanelView === "conversation" && <div style={{
          display: "flex",
          marginBottom: "var(--space-xs)"
        }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleMobileBack(false)}>
                  ← Back
                </Button>
              </div>}
            {activeSystemView || activeBookingsView ? <>
                <DevLayoutSection sectionKey="messages-system-header" parentKey="messages-conversation-panel" sectionType="section-header-row" style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px"
          }}>
                  <div>
                    <h3 style={{
                margin: 0,
                color: systemTitleColor
              }}>{activeBookingsView ? "Bookings" : "System notifications"}</h3>
                    <p style={{
                margin: "4px 0 0",
                color: palette.textMuted
              }}>
                      {systemLoading ? (
                        <InlineLoading width={140} label={activeBookingsView ? "Loading bookings" : "Loading updates"} />
                      ) : activeBookingsView ? (
                        `Customer service requests. Latest ${systemTimestampLabel}.`
                      ) : (
                        `Read-only alerts feed. Latest ${systemTimestampLabel}.`
                      )}
                    </p>
                  </div>
                  <span style={{
              padding: "4px 10px",
              borderRadius: radii.pill,
              backgroundColor: "var(--danger-surface)",
              color: "var(--danger)",
              fontSize: "var(--text-caption)",
              fontWeight: 600
            }}>
                      Read only
                    </span>
                </DevLayoutSection>
                <DevLayoutSection sectionKey="messages-system-feed" parentKey="messages-conversation-panel" sectionType="section-shell" shell backgroundToken="messages-system-feed" style={{
            marginTop: "16px",
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            overflowY: "auto",
            paddingRight: "4px"
          }}>
                  {systemLoading && <ThreadRowsSkeleton count={3} />}
                  {!systemLoading && systemError && <StatusMessage tone="danger">{systemError}</StatusMessage>}
                  {!systemLoading && !systemError && orderedSystemNotifications.length === 0 && <p style={{
              color: palette.textMuted,
              margin: 0
            }}>{activeBookingsView ? "No booking messages yet." : "No system notifications yet."}</p>}
                  {!systemLoading && !systemError && orderedSystemNotifications.length > 0 && <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }}>
                      {orderedSystemNotifications.map((note, index) => <React.Fragment key={`system-${note.notification_id}`}>
                          {showSystemUnreadMarker && systemUnreadMarkerIndex === index && <div ref={setSystemUnreadMarkerEl} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%"
                }}>
                              <div style={{
                    flex: 1,
                    height: "1px",
                    backgroundColor: palette.border
                  }} />
                              <span style={{
                    fontSize: "var(--text-caption)",
                    fontWeight: 700,
                    color: systemTitleColor
                  }}>
                                Unread
                              </span>
                              <div style={{
                    flex: 1,
                    height: "1px",
                    backgroundColor: palette.border
                  }} />
                            </div>}
                          <article data-dev-section="1" data-dev-section-key={`messages-system-note-${note.notification_id}`} data-dev-section-type="content-card" data-dev-section-parent="messages-system-feed" data-dev-background-token="messages-system-note" style={{
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  backgroundColor: "var(--surface)",
                  boxShadow: "none",
                  minHeight: "44px",
                  display: "flex",
                  flexDirection: note.kind === "customer_request" ? "row" : "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  width: "100%"
                }}>
                            {note.kind === "customer_request" ? (
                              <>
                                <div style={{
                                  display: "grid",
                                  gridTemplateColumns: "minmax(160px, 1.2fr) minmax(120px, 0.8fr) minmax(0, 2fr) minmax(120px, auto)",
                                  alignItems: "center",
                                  gap: "16px",
                                  flex: 1,
                                  minWidth: 0
                                }}>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{
                                      margin: 0,
                                      color: palette.textPrimary,
                                      fontSize: "var(--text-body-sm)",
                                      fontWeight: 700,
                                      lineHeight: 1.3,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap"
                                    }}>
                                      {note.customer_name}
                                    </p>
                                    <p style={{
                                      margin: "2px 0 0",
                                      fontSize: "var(--text-caption)",
                                      color: palette.textMuted,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap"
                                    }}>
                                      {note.type_label}
                                    </p>
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    {note.vehicle_label ? (
                                      <p style={{
                                        margin: 0,
                                        fontSize: "var(--text-body-sm)",
                                        color: palette.textPrimary,
                                        fontWeight: 600,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap"
                                      }}>
                                        {note.vehicle_label}
                                      </p>
                                    ) : null}
                                  </div>
                                  <p style={{
                                    margin: 0,
                                    fontSize: "var(--text-body-sm)",
                                    color: palette.textPrimary,
                                    lineHeight: 1.4,
                                    minWidth: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical"
                                  }}>
                                    {note.description || ""}
                                  </p>
                                  <div style={{ minWidth: 0, textAlign: "right" }}>
                                    {note.preferred_date ? (
                                      <p style={{
                                        margin: 0,
                                        fontSize: "var(--text-caption)",
                                        color: palette.textPrimary,
                                        fontWeight: 600,
                                        whiteSpace: "nowrap"
                                      }}>
                                        Preferred: {note.preferred_date}
                                      </p>
                                    ) : null}
                                    <p style={{
                                      margin: note.preferred_date ? "2px 0 0" : 0,
                                      fontSize: "var(--text-caption)",
                                      color: palette.textMuted,
                                      whiteSpace: "nowrap"
                                    }}>
                                      {formatNotificationTimestamp(note.created_at)}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="app-btn app-btn--primary app-btn--sm app-btn--pill"
                                  style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}
                                  onClick={() =>
                                    typeof handleCreateJobFromRequest === "function" &&
                                    handleCreateJobFromRequest(note)
                                  }
                                >
                                  Create job
                                </button>
                              </>
                            ) : (
                              <>
                                <p style={{
                                  margin: 0,
                                  color: palette.textPrimary,
                                  fontSize: "var(--text-body-sm)",
                                  fontWeight: 650,
                                  lineHeight: 1.35,
                                  minWidth: 0,
                                }}>
                                  {String(note.message || "System update").replace(/^[\s\p{Extended_Pictographic}\uFE0F]+/u, "").trim() || "System update"}
                                </p>
                                <p style={{
                                  margin: 0,
                                  fontSize: "var(--text-caption)",
                                  color: palette.textMuted,
                                  flex: "0 0 auto",
                                  whiteSpace: "nowrap",
                                }}>
                                  {formatNotificationTimestamp(note.created_at)}
                                </p>
                              </>
                            )}
                          </article>
                        </React.Fragment>)}
                    </div>}
                </DevLayoutSection>
              </> : activeThread ? <>
                <DevLayoutSection sectionKey="messages-thread-header" parentKey="messages-conversation-panel" sectionType="section-header-row" style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            paddingBottom: "12px",
            flexWrap: "wrap"
          }}>
                  <div style={{
              flex: "1 1 auto",
              minWidth: 0
            }}>
                    {isGroupChat ? <h3 onClick={() => setGroupMembersModalOpen(true)} style={{
                margin: 0,
                color: systemTitleColor,
                cursor: "pointer"
              }} title="Click to view members">
                        {activeThread.title}
                      </h3> : <h3 style={{
                margin: 0,
                color: systemTitleColor
              }}>{activeThread.title}</h3>}
                    {headerHasCustomerMember ? (
                      customerDetail && (customerDetail.phone || customerDetail.vehicle || customerDetail.jobNumber) ? <p style={{
                  margin: "4px 0 0",
                  color: palette.textMuted,
                  fontSize: "var(--text-body-sm)",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "4px 12px"
                }}>
                        {customerDetail.phone ? <span>{customerDetail.phone}</span> : null}
                        {customerDetail.vehicle ? <span>{customerDetail.vehicle}</span> : null}
                        {customerDetail.jobNumber ? <span>JOB {customerDetail.jobNumber}</span> : null}
                      </p> : null
                    ) : (() => {
                if (isGroupChat) return null;
                const otherMember = (activeThread.members || []).find(member => member.userId !== dbUserId);
                const role = otherMember?.profile?.role;
                const extension = otherMember?.profile?.extension;
                if (!role && !extension) return null;
                return <p style={{
                  margin: "4px 0 0",
                  color: palette.textMuted,
                  fontSize: "var(--text-body-sm)",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "4px 12px"
                }}>
                        {role ? <span>{role}</span> : null}
                        {extension ? <span>Ext. {extension}</span> : null}
                      </p>;
              })()}
                  </div>
                  {isGroupChat && canEditGroup && !isCustomerChat && <div style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              flexWrap: "wrap",
              justifyContent: "flex-end"
            }}>
                      <Button type="button" variant="secondary" size="sm" pill onClick={openGroupEditModal}>
                        Edit
                      </Button>
                    </div>}
                </DevLayoutSection>

                <DevLayoutSection sectionKey="messages-thread-feed" parentKey="messages-conversation-panel" sectionType="section-shell" shell backgroundToken="messages-thread-feed" ref={scrollerRef} style={{
            marginTop: isMobileView ? "8px" : "16px",
            flex: 1,
            minHeight: 0,
            height: isMobileView ? "min(52vh, 360px)" : undefined,
            maxHeight: isMobileView ? "min(52vh, 360px)" : "none",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: isMobileView ? "12px" : "18px",
            padding: isMobileView ? "18px 10px 12px" : "22px 12px 14px",
            overscrollBehavior: "contain"
          }}>
                  {loadingMessages && <MessageBubblesSkeleton count={4} />}
                  {!loadingMessages && messages.length === 0 && <p style={{
              color: palette.textMuted
            }}>No messages yet.</p>}
                  {messages.map((message, index) => {
              const prev = index > 0 ? messages[index - 1] : null;
              const next = index < messages.length - 1 ? messages[index + 1] : null;
              const currentDate = new Date(message.createdAt);
              const prevDate = prev ? new Date(prev.createdAt) : null;
              const sameDayAsPrev = prevDate && prevDate.toDateString() === currentDate.toDateString();
              const showDayDivider = !sameDayAsPrev;
              const GROUP_WINDOW_MS = 5 * 60 * 1000;
              const sameSenderAsPrev = prev && sameDayAsPrev && prev.senderId === message.senderId && currentDate - prevDate < GROUP_WINDOW_MS;
              const nextDate = next ? new Date(next.createdAt) : null;
              const sameDayAsNext = nextDate && nextDate.toDateString() === currentDate.toDateString();
              const sameSenderAsNext = next && sameDayAsNext && next.senderId === message.senderId && nextDate - currentDate < GROUP_WINDOW_MS;
              const isFirstInGroup = !sameSenderAsPrev;
              const isLastInGroup = !sameSenderAsNext;
              const dayLabel = currentDate.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
              });
              return <React.Fragment key={message.id}>
                        {showDayDivider && <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%"
                }}>
                            <div style={{
                    flex: 1,
                    height: "1px",
                    backgroundColor: palette.border
                  }} />
                            <span style={{
                    fontSize: "var(--text-caption)",
                    fontWeight: 700,
                    color: systemTitleColor
                  }}>
                              {dayLabel}
                            </span>
                            <div style={{
                    flex: 1,
                    height: "1px",
                    backgroundColor: palette.border
                  }} />
                          </div>}
                        {showThreadUnreadMarker && activeThreadUnreadMarkerIndex === index && <div ref={setThreadUnreadMarkerEl} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%"
                }}>
                            <div style={{
                    flex: 1,
                    height: "1px",
                    backgroundColor: palette.border
                  }} />
                            <span style={{
                    fontSize: "var(--text-caption)",
                    fontWeight: 700,
                    color: systemTitleColor
                  }}>
                              Unread
                            </span>
                            <div style={{
                    flex: 1,
                    height: "1px",
                    backgroundColor: palette.border
                  }} />
                          </div>}
                        <MessageBubble message={message} isMine={message.senderId === dbUserId} nameColor={userNameColor} userRoles={user?.roles || []} currentUserId={dbUserId} onApproveLeaveRequest={handleApproveLeaveRequest} onDeclineLeaveRequest={handleOpenDeclineLeaveRequest} decisionBusy={leaveDecisionBusy} isFirstInGroup={isFirstInGroup} isLastInGroup={isLastInGroup} reactions={messageReactions[message.id] || []} onReact={emoji => setMessageReactions(prev => {
                  const current = prev[message.id] || [];
                  const existing = current.find(r => r.userId === dbUserId && r.emoji === emoji);
                  const nextList = existing ? current.filter(r => !(r.userId === dbUserId && r.emoji === emoji)) : [...current, {
                    userId: dbUserId,
                    emoji
                  }];
                  return {
                    ...prev,
                    [message.id]: nextList
                  };
                })} onReply={() => setReplyTo(message)} />
                      </React.Fragment>;
            })}
                </DevLayoutSection>

                <DevLayoutSection as="form" sectionKey="messages-thread-composer" parentKey="messages-conversation-panel" sectionType="toolbar" onSubmit={handleSendMessage} style={{
            marginTop: "16px",
            paddingTop: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            position: "relative"
          }}>
                  {/* Command suggestions dropdown */}
                  {showCommandSuggestions && commandSuggestions.length > 0 && <div data-dev-section="1" data-dev-section-key="messages-command-suggestions" data-dev-section-type="floating-action" data-dev-section-parent="messages-thread-composer" data-dev-background-token="messages-command-suggestions" style={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              right: 0,
              marginBottom: "8px",
              maxHeight: "240px",
              overflowY: "auto",
              backgroundColor: "var(--surface)",
              borderRadius: radii.lg,
              boxShadow: shadows.lg,
              zIndex: "var(--z-dropdown)"
            }}>
                      {commandSuggestions.map((cmd, index) => <div key={index} role="button" tabIndex={0} onClick={() => handleSelectCommand(cmd)} onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSelectCommand(cmd);
                }
              }} style={{
                width: "100%",
                textAlign: "left",
                padding: "var(--space-3) var(--space-4)",
                borderBottom: index < commandSuggestions.length - 1 ? "var(--separating-line)" : "none",
                backgroundColor: "var(--surface)",
                cursor: "pointer",
                transition: "background-color 0.15s"
              }} onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = "var(--theme)";
              }} onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = "var(--surface)";
              }}>
                          <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-xs)"
                }}>
                            <span style={{
                    fontWeight: 700,
                    color: palette.accent,
                    fontSize: "var(--text-body)"
                  }}>
                              {cmd.command}
                            </span>
                            <span style={{
                    fontSize: "var(--text-body-sm)",
                    color: palette.textMuted
                  }}>
                              {cmd.description}
                            </span>
                          </div>
                        </div>)}
                    </div>}

                  {replyTo && <div style={{
              display: "flex",
              alignItems: "stretch",
              gap: "10px",
              padding: "8px 12px",
              borderRadius: radii.lg,
              backgroundColor: "var(--search-surface)",
              position: "relative"
            }}>
                      <div style={{
                width: "3px",
                borderRadius: "2px",
                backgroundColor: palette.accent
              }} />
                      <div style={{
                flex: 1,
                minWidth: 0
              }}>
                        <div style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: palette.accent
                }}>
                          Replying to {replyTo.sender?.name || "message"}
                        </div>
                        <div style={{
                  fontSize: "0.78rem",
                  color: palette.textMuted,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}>
                          {String(replyTo.content || "").slice(0, 140)}
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="xs" pill onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                        ×
                      </Button>
                    </div>}
                  <textarea id="message-textarea" rows={3} value={messageDraft} onChange={handleMessageDraftChange} placeholder="Write an internal update… (type / for commands)" style={{
              width: "100%",
              borderRadius: radii.lg,
              border: "none",
              outline: "none",
              padding: "12px 14px",
              resize: "none",
              backgroundColor: "var(--surface)"
            }} />
                  <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--space-3)"
            }}>
                    <Button type="button" variant="secondary" size="sm" pill onClick={() => setCommandHelpOpen(true)} title="Slash command help" aria-label="Slash command help">
                      ?
                    </Button>
                    <Button type="submit" variant="primary" pill disabled={!canSend}>
                      {sending ? "Sending…" : "Send"}
                    </Button>
                  </div>
                  {conversationError && <StatusMessage tone="danger">{conversationError}</StatusMessage>}
                </DevLayoutSection>
              </> : <DevLayoutSection sectionKey="messages-empty-state" parentKey="messages-conversation-panel" sectionType="content-card" backgroundToken="messages-empty-state" style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: palette.textMuted,
          textAlign: "center"
        }}>
                Select or start a conversation to begin messaging.
              </DevLayoutSection>}
          </DevLayoutSection>
        </DevLayoutSection>
      </DevLayoutSection>

      {leaveDeclineModal.open && <ModalPortal>
          <div style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "var(--overlay)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      zIndex: "var(--z-modal)"
    }}>
            <div style={{
        width: "min(520px, 100%)",
        backgroundColor: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        boxShadow: shadows.lg,
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "14px"
      }}>
              <div>
                <h3 style={{
            margin: 0,
            color: systemTitleColor
          }}>Decline leave request</h3>
                <p style={{
            margin: "6px 0 0",
            color: palette.textMuted
          }}>
                  A reason is required before this request can be declined.
                </p>
              </div>

              <textarea className="app-input" rows={4} value={leaveDeclineReason} onChange={event => {
          setLeaveDeclineReason(event.target.value);
          setLeaveDecisionError("");
        }} placeholder="Enter the reason for declining this request..." style={{
          width: "100%",
          resize: "vertical"
        }} />

              {leaveDecisionError ? <StatusMessage tone="danger">{leaveDecisionError}</StatusMessage> : null}

              <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--space-2)"
        }}>
                <Button type="button" variant="secondary" pill disabled={leaveDecisionBusy} onClick={() => {
            if (leaveDecisionBusy) return;
            setLeaveDeclineModal({
              open: false,
              message: null
            });
            setLeaveDeclineReason("");
            setLeaveDecisionError("");
          }}>
                  Cancel
                </Button>
                <Button type="button" variant="danger" pill disabled={leaveDecisionBusy} onClick={handleConfirmDeclineLeaveRequest}>
                  {leaveDecisionBusy ? "Declining..." : "Decline request"}
                </Button>
              </div>
            </div>
          </div>
        </ModalPortal>}

      {groupEditModalOpen && isGroupChat && <ModalPortal>
          <div style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "var(--overlay)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      zIndex: "var(--z-modal)"
    }}>
            <div style={{
        width: "min(560px, 100%)",
        maxHeight: "90vh",
        overflowY: "auto",
        backgroundColor: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        boxShadow: shadows.lg,
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}>
            <div>
              <h3 style={{
            margin: 0,
            color: systemTitleColor
          }}>Edit group chat</h3>
              <p style={{
            margin: "4px 0 0",
            color: palette.textMuted
          }}>
                Rename the chat or remove people who should no longer access it.
              </p>
            </div>

            <InputField label="Group name" type="text" value={groupEditTitle} onChange={event => setGroupEditTitle(event.target.value)} placeholder="Group name" />

            <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}>
              <strong style={{
            fontSize: "var(--text-body-sm)",
            color: palette.textMuted
          }}>
                Members ({activeThread.members.length})
              </strong>
              <div style={{
            maxHeight: "240px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
                {activeThread.members.map(member => {
              const isSelf = member.userId === dbUserId;
              const canRemoveMember = canEditGroup && member.userId !== dbUserId && !(member.role === "leader" && groupLeaderCount <= 1);
              return <div key={member.userId} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                backgroundColor: "var(--surface)",
                gap: "12px",
                flexWrap: "wrap"
              }}>
                      <div style={{
                  display: "flex",
                  flexDirection: "column"
                }}>
                        <span style={{
                    fontWeight: 600,
                    color: userNameColor
                  }}>
                          {member.profile?.name || "Unknown"}
                          {isSelf ? " • You" : ""}
                        </span>
                        <span style={{
                    fontSize: "var(--text-label)",
                    color: palette.textMuted
                  }}>
                          {member.role === "leader" ? "Leader" : "Member"}
                        </span>
                      </div>
                      {canRemoveMember && <Button type="button" variant="danger" size="sm" pill onClick={() => handleRemoveMemberFromGroup(member.userId)} disabled={groupManageBusy}>
                          Remove
                        </Button>}
                    </div>;
            })}
              </div>
            </div>

            {isGroupLeader && <div style={{
          borderRadius: "var(--radius-md)",
          padding: "12px",
          backgroundColor: "var(--search-surface)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          color: "var(--search-text)"
        }}>
                <strong style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--search-text)"
          }}>
                  Manage group members
                </strong>
                <SearchBar value={groupSearchTerm} onChange={event => setGroupSearchTerm(event.target.value)} onClear={() => setGroupSearchTerm("")} placeholder="Search colleagues to add (min 2 letters)…" style={{
            width: "100%"
          }} />
                {groupSearchTerm.trim().length > 0 && groupSearchTerm.trim().length < 2 && <p style={{
            margin: 0,
            fontSize: "var(--text-caption)",
            color: "var(--search-text)"
          }}>
                    Keep typing at least 2 letters to search.
                  </p>}
                {groupSearchLoading && <InlineLoading width={160} label="Looking up colleagues" />}
                {!groupSearchLoading && groupSearchResults.length > 0 && <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            maxHeight: "160px",
            overflowY: "auto"
          }}>
                    {groupSearchResults.map(entry => <div key={entry.id} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              backgroundColor: "var(--surface)"
            }}>
                        <div>
                          <strong style={{
                  fontSize: "var(--text-body)",
                  color: userNameColor
                }}>
                            {entry.name}
                          </strong>
                          <p style={{
                  margin: 0,
                  fontSize: "var(--text-caption)",
                  color: palette.textMuted
                }}>
                            {entry.role || "Team member"}
                          </p>
                        </div>
                        <Button type="button" variant="primary" size="sm" pill disabled={groupManageBusy} onClick={() => handleAddMemberToGroup(entry.id)}>
                          Add
                        </Button>
                      </div>)}
                  </div>}
                {!groupSearchLoading && groupSearchTerm.trim().length >= 2 && groupSearchResults.length === 0 && <p style={{
            margin: 0,
            fontSize: "var(--text-label)",
            color: palette.textMuted
          }}>
                      No colleagues match that search.
                    </p>}
                {groupManageError && <StatusMessage tone="danger">{groupManageError}</StatusMessage>}
              </div>}

            {groupEditError && <StatusMessage tone="danger">{groupEditError}</StatusMessage>}

            <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--space-2)"
        }}>
              <Button type="button" variant="secondary" pill onClick={closeGroupEditModal}>
                Cancel
              </Button>
              <Button type="button" variant="primary" pill onClick={handleSaveGroupDetails} disabled={groupEditBusy}>
                {groupEditBusy ? "Saving…" : "Save changes"}
              </Button>
            </div>
            </div>
          </div>
        </ModalPortal>}

      {newChatModalOpen && <ModalPortal>
          <div className="popup-backdrop start-new-chat-backdrop">
            <div className="popup-card start-new-chat-popup" style={{
        borderRadius: "var(--radius-xl)",
        width: "100%",
        maxWidth: "640px",
        maxHeight: "90vh",
        overflowY: "auto",
        border: "none"
      }}>
              <div style={{
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
                <div>
                  <h3 style={{
              margin: 0,
              color: systemTitleColor
            }}>Start New Chat</h3>
                </div>

            <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-2)"
          }}>
              <ComposeToggleButton active={composeMode === "direct"} onClick={() => {
              setComposeMode("direct");
              setComposeError("");
              setSelectedRecipients(prev => prev.length ? [prev[0]] : []);
            }}>
                Direct
              </ComposeToggleButton>
              <ComposeToggleButton active={composeMode === "group"} onClick={() => {
              setComposeMode("group");
              setComposeError("");
            }}>
                Group
              </ComposeToggleButton>
            </div>

            <SearchBar placeholder="Search everyone..." value={directorySearch} onChange={event => setDirectorySearch(event.target.value)} onClear={() => setDirectorySearch("")} style={{
            width: "100%"
          }} />

            <div style={{
            height: "320px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            paddingTop: "2px",
            paddingBottom: "2px"
          }}>
              {directoryLoading && <ColleagueRowsSkeleton count={6} />}
              {!directoryLoading && directory.length === 0 && <p style={{
              margin: 0,
              color: palette.textMuted
            }}>No colleagues found.</p>}
              {!directoryLoading && directory.length > 0 && <>
                  {directory.map(entry => {
                const selected = isRecipientSelected(entry);
                return <div key={entry.id} className="chat-user-option" role="button" tabIndex={0} onClick={() => handleDirectoryUser(entry)} onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleDirectoryUser(entry);
                  }
                }} style={{
                  textAlign: "left",
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${selected ? palette.accent : palette.border}`,
                  padding: "var(--space-3) var(--space-4)",
                  backgroundColor: selected ? palette.accentSurface : "var(--surface)",
                  cursor: "pointer"
                }}>
                        <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "var(--space-3)"
                  }}>
                          <span style={{
                      fontSize: "var(--text-h4)",
                      fontWeight: 700,
                      color: userNameColor
                    }}>
                            {entry.name}
                          </span>
                          <span style={{
                      fontSize: "var(--text-body-sm)",
                      color: palette.textMuted,
                      fontWeight: 600
                    }}>
                            {entry.role || "Team member"}
                          </span>
                        </div>
                      </div>;
              })}
                </>}
            </div>

            <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
              <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              maxHeight: "120px",
              overflowY: "auto",
              paddingRight: "2px"
            }}>
                {selectedRecipients.length ? selectedRecipients.map(entry => <Chip key={entry.id} label={entry.name} onRemove={() => setSelectedRecipients(prev => prev.filter(user => user.id !== entry.id))} color={userNameColor} />) : <span style={{
                color: palette.textMuted,
                fontSize: "var(--text-body-sm)"
              }}>
                    No participants selected yet.
                  </span>}
              </div>

              {composeMode === "group" && <InputField type="text" placeholder="Group name (optional)" value={groupName} onChange={event => setGroupName(event.target.value)} />}
            </div>

            {composeError && <StatusMessage tone="danger">{composeError}</StatusMessage>}

            <div style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--space-2)"
          }}>
              <Button type="button" variant="secondary" pill onClick={closeNewChatModal}>
                Cancel
              </Button>
              <Button type="button" variant="primary" pill onClick={handleStartChat} disabled={!canInitiateChat}>
                Start Chat
              </Button>
            </div>
              </div>
            </div>
          </div>
        </ModalPortal>}

      {/* Command Help Modal */}
      {commandHelpOpen && <ModalPortal>
          <div onClick={() => setCommandHelpOpen(false)} style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "var(--overlay)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "var(--z-modal)"
    }}>
            <div onClick={e => e.stopPropagation()} style={{
        ...cardStyle,
        maxWidth: "600px",
        width: "90%",
        maxHeight: "80vh",
        overflowY: "auto",
        gap: "20px"
      }}>
            <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
              <h3 style={{
            margin: 0,
            color: palette.textPrimary
          }}>Slash Commands Help</h3>
              <Button variant="ghost" size="sm" pill onClick={() => setCommandHelpOpen(false)} aria-label="Close">
                ×
              </Button>
            </div>

            <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
              <p style={{
            color: palette.textMuted,
            margin: 0
          }}>
                Use slash commands in your messages to create quick links and references.
                Commands shown are based on your role and permissions.
              </p>
              <div style={{
            padding: "8px 12px",
            backgroundColor: "var(--theme)",
            borderRadius: radii.lg,
            fontSize: "var(--text-body-sm)"
          }}>
                <strong style={{
              color: palette.accent
            }}>Click any command below</strong> to insert it into your message!
              </div>

              {/* Organize commands by category */}
              {(() => {
            const categories = {
              'Jobs & Work': availableCommands.filter(cmd => ['job', '', 'myjobs', 'archive', 'appointments'].includes(cmd.pattern)),
              'Customers & Accounts': availableCommands.filter(cmd => ['cust', 'customer', 'addcust', 'account', 'invoice'].includes(cmd.pattern)),
              'Vehicles': availableCommands.filter(cmd => ['vehicle', 'vhc', 'tracking', 'valet'].includes(cmd.pattern)),
              'Parts & Inventory': availableCommands.filter(cmd => ['part', 'parts', 'order'].includes(cmd.pattern)),
              'Team & Operations': availableCommands.filter(cmd => ['user', 'hr', 'clocking'].includes(cmd.pattern))
            };
            return Object.entries(categories).map(([category, commands]) => {
              if (commands.length === 0) return null;
              return <div key={category}>
                      <h4 style={{
                  margin: "0 0 8px 0",
                  fontSize: "var(--text-body-sm)",
                  fontWeight: 700,
                  color: palette.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}>
                        {category}
                      </h4>
                      <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}>
                        {commands.map((cmd, idx) => <div key={idx} onClick={() => handleInsertCommandFromHelp(cmd)} style={{
                    padding: "10px 12px",
                    backgroundColor: "var(--theme)",
                    borderRadius: radii.lg,
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }} onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = "var(--theme)";
                    e.currentTarget.style.transform = "translateX(4px)";
                  }} onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = "var(--theme)";
                    e.currentTarget.style.transform = "translateX(0)";
                  }}>
                            <strong style={{
                      color: palette.accent,
                      fontSize: "var(--text-body)"
                    }}>
                              {cmd.command}
                            </strong>
                            <p style={{
                      margin: "2px 0 0 0",
                      fontSize: "var(--text-body-sm)",
                      color: palette.textMuted
                    }}>
                              {cmd.description}
                            </p>
                          </div>)}
                      </div>
                    </div>;
            });
          })()}

              {/* Tips Section */}
              <div style={{
            marginTop: "8px",
            paddingTop: "16px"
          }}>
                <div style={{
              padding: "12px",
              backgroundColor: "var(--success-surface)",
              borderRadius: radii.lg
            }}>
                <strong style={{
                color: "var(--success)"
              }}>Smart Linking:</strong>
                <p style={{
                margin: "4px 0 0 0",
                fontSize: "var(--text-body)",
                color: palette.textMuted
              }}>
                  When you use <code>/job[number]</code> together with <code>/vehicle</code> or <code>/customer</code>,
                  the system automatically links the vehicle and customer from that job!
                </p>
              </div>

              <div style={{
              padding: "12px",
              backgroundColor: "var(--warning-surface)",
              borderRadius: radii.lg
            }}>
                <strong style={{
                color: "var(--warning)"
              }}>Tip:</strong>
                <p style={{
                margin: "4px 0 0 0",
                fontSize: "var(--text-body)",
                color: palette.textMuted
              }}>
                  Commands are case-insensitive and will be automatically linked when you send your message.
                </p>
              </div>
              </div>
            </div>
            </div>
          </div>
        </ModalPortal>}

      {/* Group Members Modal */}
      {groupMembersModalOpen && activeThread && isGroupChat && <ModalPortal>
          <div onClick={() => setGroupMembersModalOpen(false)} style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "var(--overlay)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "var(--z-modal)"
    }}>
            <div onClick={e => e.stopPropagation()} style={{
        ...cardStyle,
        maxWidth: "500px",
        width: "90%",
        maxHeight: "70vh",
        overflowY: "auto",
        gap: "20px"
      }}>
            <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
              <h3 style={{
            margin: 0,
            color: palette.textPrimary
          }}>
                {activeThread.title || "Group Chat"}
              </h3>
              <Button variant="ghost" size="sm" pill onClick={() => setGroupMembersModalOpen(false)} aria-label="Close">
                ×
              </Button>
            </div>

            <div>
              <h4 style={{
            margin: "0 0 12px 0",
            color: palette.textMuted,
            fontSize: "var(--text-body)"
          }}>
                Members ({activeThread.members.length})
              </h4>
              <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
                {activeThread.members.map(member => <div key={member.userId} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px",
              backgroundColor: "var(--theme)",
              borderRadius: radii.lg
            }}>
                    <div>
                      <div style={{
                  fontWeight: 600,
                  color: palette.textPrimary
                }}>
                        {member.profile?.name || "Unknown"}
                      </div>
                      <div style={{
                  fontSize: "var(--text-body-sm)",
                  color: palette.textMuted
                }}>
                        {member.profile?.role || "Unknown role"}
                      </div>
                    </div>
                    {member.role === "leader" && <span style={{
                padding: "4px 12px",
                borderRadius: radii.pill,
                backgroundColor: palette.accentSurface,
                color: palette.accent,
                fontSize: "var(--text-caption)",
                fontWeight: 700
              }}>
                        Leader
                      </span>}
                  </div>)}
              </div>
            </div>
            </div>
          </div>
        </ModalPortal>}
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
