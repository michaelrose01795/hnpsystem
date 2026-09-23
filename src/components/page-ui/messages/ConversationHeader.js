// file location: src/components/page-ui/messages/ConversationHeader.js
//
// The top of an open conversation: who / what it is, presence, its type,
// status and priority, and two actions: the details panel and "more" (search,
// pin, rename, mute, help, remove — built by the page). Members live in the
// details panel.
//
// Presence is words first ("On job 12345", "Active now", "Last seen 14:02"),
// with a small dot beside them; never a picture of the person.

import React, { useCallback, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import SymbolButton from "@/components/ui/SymbolButton";
import FloatingLayer from "@/components/page-ui/messages/FloatingLayer";
import {
  getConversationType,
  getPriority,
  getStatus,
  typeSupportsWorkflow,
} from "@/lib/messages/conversationModel";

export default function ConversationHeader({
  thread,
  title,
  subtitle,
  presence,
  isMobile,
  onBack,
  detailsOpen,
  onToggleDetails,
  menuItems = [],
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const type = getConversationType(thread?.conversationType);
  const status = getStatus(thread?.status);
  const priority = getPriority(thread?.priority);
  const workflow = typeSupportsWorkflow(thread?.conversationType) && thread?.hubReady;

  return (
    <header
      className="app-msg-header"
      data-dev-section="1"
      data-dev-section-key="messages-thread-header"
      data-dev-section-type="section-header-row"
    >
      <div className="app-msg-header__identity">
        {isMobile && <SymbolButton symbol="back" label="Back to conversations" onClick={onBack} />}
        <div className="app-msg-header__text">
          <h2 className="app-msg-header__title" title={title}>
            {title}
          </h2>
          <div className="app-msg-header__meta">
            <span className={`app-msg-tag${type.external ? " app-msg-tag--external" : " app-msg-tag--accent"}`}>
              {type.external ? "Customer · external" : `${type.label} · internal`}
            </span>
            {workflow ? (
              <span className={`app-msg-tag app-msg-tag--${status.tone === "success" ? "success" : status.tone === "warning" ? "warning" : "accent"}`}>
                {status.label}
              </span>
            ) : null}
            {workflow && priority.rank !== 1 ? (
              <span className={`app-msg-tag${priority.rank >= 3 ? " app-msg-tag--danger" : priority.rank === 2 ? " app-msg-tag--warning" : ""}`}>
                {priority.label} priority
              </span>
            ) : null}
            {presence ? (
              <span className={`app-msg-presence${presence.tone ? ` app-msg-presence--${presence.tone}` : ""}`}>
                {presence.text}
              </span>
            ) : null}
            {subtitle ? <span className="app-msg-muted">{subtitle}</span> : null}
          </div>
        </div>
      </div>

      <div className="app-msg-header__actions">
        <SymbolButton
          symbol="details"
          label={detailsOpen ? "Hide details" : "Show details"}
          aria-pressed={detailsOpen}
          onClick={onToggleDetails}
        />
        {menuItems.length > 0 && (
          <span ref={moreRef} className="app-msg-anchor">
            <SymbolButton
              symbol="more"
              label="More options"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((value) => !value)}
            />
          </span>
        )}
      </div>

      {menuOpen && (
        <FloatingLayer
          anchorRef={moreRef}
          align="end"
          placement="below"
          onClose={closeMenu}
          className="app-msg-menu"
          role="menu"
          aria-label="Conversation options"
        >
          {menuItems.map((item) => (
            <Button
              key={item.label}
              type="button"
              role="menuitem"
              variant={item.danger ? "danger" : "secondary"}
              symbol={false}
              disabled={item.disabled}
              onClick={() => {
                setMenuOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </Button>
          ))}
        </FloatingLayer>
      )}
    </header>
  );
}
