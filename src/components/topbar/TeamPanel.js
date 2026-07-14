// file location: src/components/topbar/TeamPanel.js
//
// Collaborative operational workspace panel (Phase 4). A right-hand drawer — the
// team-facing counterpart to the personal WorkspacePanel (3.6) — that surfaces:
//   • Escalations needing attention (4.5)
//   • Your availability, self-declarable (4.2)
//   • Live team presence per department (4.1)
//   • Shared department activity (4.3)
//   • Manager collaboration tools (4.6, manager-only)
//   • Cross-department coordination (4.7)
// with one-click "message" shortcuts throughout (4.4). Opened with ⌘/Ctrl+U or
// from the palette; adds NOTHING to the top bar.
//
// Obeys the layer/border laws: the shared PopupModal (borderless) as an edge
// drawer, each block a canonical LayerTheme surface, list rules via
// --separating-line, focus/inputs via the allowed rings. Data-driven and
// presentational — all logic lives in the pure registries/hooks it's fed from.

import React from "react";
import { useRouter } from "next/router";
import PopupModal from "@/components/popups/popupStyleApi";
import LayerTheme from "@/components/ui/LayerTheme";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { selectableStates } from "@/config/topbar/availabilityStates";
import { memberContactAction, audienceContactAction } from "@/config/topbar/communicationShortcuts";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

const TONE_COLOR = {
  danger: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--info)",
  success: "var(--success-base)",
  neutral: "var(--text-1)",
};

function toneColor(tone) {
  return TONE_COLOR[tone] || "var(--text-1)";
}

function Dot({ tone }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        borderRadius: "var(--radius-pill)",
        background: toneColor(tone),
        flexShrink: 0,
      }}
    />
  );
}

// A block heading matching the WorkspacePanel widget header treatment.
function BlockHeading({ icon, title, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span aria-hidden="true">{icon}</span>
      <h3
        style={{
          margin: 0,
          flex: 1,
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-1)",
          opacity: 0.7,
        }}
      >
        {title}
      </h3>
      {action}
    </div>
  );
}

// A generic actionable row: primary label/subtitle (navigates if it has href)
// plus an optional trailing "message" button.
function Row({ tone, icon, label, subtitle, href, onNavigate, messageHref, messageLabel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <button
        type="button"
        onClick={() => href && onNavigate(href)}
        disabled={!href}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          padding: "8px 6px",
          border: "none",
          background: "transparent",
          color: "var(--text-1)",
          cursor: href ? "pointer" : "default",
          font: "inherit",
          borderRadius: "var(--radius-sm)",
        }}
      >
        {icon ? <span aria-hidden="true">{icon}</span> : <Dot tone={tone} />}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "0.86rem",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
          {subtitle && (
            <span style={{ display: "block", fontSize: "0.7rem", opacity: 0.55 }}>{subtitle}</span>
          )}
        </span>
        {href && <span aria-hidden="true" style={{ opacity: 0.4 }}>→</span>}
      </button>
      {messageHref && (
        <button
          type="button"
          onClick={() => onNavigate(messageHref)}
          className="app-btn app-btn--ghost"
          aria-label={messageLabel || "Message"}
          title={messageLabel || "Message"}
          style={{ padding: "4px 8px", minHeight: 0, flexShrink: 0 }}
        >
          💬
        </button>
      )}
    </div>
  );
}

// A single presence member row: availability icon + name/role + optional job +
// a message shortcut.
function PresenceRow({ member, onNavigate }) {
  const contact = memberContactAction(member);
  const subtitleParts = [member.roleLabel];
  if (member.jobNumber) subtitleParts.push(`Job ${member.jobNumber}`);
  return (
    <Row
      tone={member.state?.tone}
      icon={member.state?.icon}
      label={member.isSelf ? `${member.name} (you)` : member.name}
      subtitle={`${member.state?.short || ""} · ${subtitleParts.filter(Boolean).join(" · ")}`}
      href={null}
      onNavigate={onNavigate}
      messageHref={contact?.href}
      messageLabel={contact?.label}
    />
  );
}

function DepartmentGroup({ group, onNavigate }) {
  const contact = audienceContactAction(group.code, [group]);
  const shown = group.members.slice(0, WORKSPACE_LIMITS.presencePerDepartment);
  const extra = group.total - shown.length;
  return (
    <LayerTheme radius="var(--radius-md)" gap="6px" padding="12px">
      <BlockHeading
        icon="👥"
        title={`${group.name} · ${group.available} free`}
        action={
          contact?.href ? (
            <button
              type="button"
              onClick={() => onNavigate(contact.href)}
              className="app-btn app-btn--ghost"
              style={{ padding: "2px 8px", minHeight: 0 }}
              title={contact.label}
            >
              📣
            </button>
          ) : null
        }
      />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {shown.map((member) => (
          <PresenceRow key={member.id} member={member} onNavigate={onNavigate} />
        ))}
        {extra > 0 && (
          <p style={{ margin: "4px 6px 0", fontSize: "0.72rem", opacity: 0.5 }}>
            +{extra} more on the team
          </p>
        )}
      </div>
    </LayerTheme>
  );
}

export default function TeamPanel({
  isOpen = false,
  onClose,
  department = null,
  departmentName = null,
  presence = { departments: [], myDepartment: null, self: null, totals: {} },
  selfAvailability = null,
  escalations = [],
  activity = [],
  managerTools = { isManager: false, sections: [] },
  coordination = [],
}) {
  const router = useRouter();
  useEscapeKey(onClose, isOpen);

  const go = (href) => {
    if (!href) return;
    onClose?.();
    router.push(href);
  };

  if (!isOpen) return null;

  const myDept = presence.myDepartment;
  const otherDepts = (presence.departments || []).filter((d) => d.code !== department);
  const selfState = selfAvailability?.state;

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Team workspace"
      backdropStyle={{ justifyContent: "flex-end", alignItems: "stretch", padding: 0, zIndex: 9998 }}
      cardStyle={{
        width: "min(100%, 460px)",
        height: "100dvh",
        maxHeight: "100dvh",
        borderRadius: 0,
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "16px 18px",
          borderBottom: "var(--separating-line)", // header rule (allowed separator)
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--accent)" }}>
            Team workspace
          </h2>
          {departmentName && (
            <p style={{ margin: "2px 0 0", fontSize: "0.75rem", opacity: 0.6 }}>
              {departmentName} · {presence.totals?.available ?? 0} available now
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="app-btn app-btn--ghost"
          aria-label="Close team workspace"
        >
          Close
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "14px 14px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* 4.5 — Escalations needing attention (top when present) */}
        {escalations.length > 0 && (
          <LayerTheme radius="var(--radius-md)" gap="6px" padding="14px">
            <BlockHeading icon="🚨" title="Needs attention" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              {escalations.map((esc) => (
                <Row
                  key={esc.id}
                  tone={esc.tone}
                  label={esc.title}
                  subtitle={`${esc.severityLabel} · ${esc.detail}`}
                  href={esc.href}
                  onNavigate={go}
                  messageHref={audienceContactAction(esc.audience, presence.departments)?.href}
                  messageLabel={`Message the ${esc.audience} team`}
                />
              ))}
            </div>
          </LayerTheme>
        )}

        {/* 4.2 — My availability */}
        {selfAvailability && (
          <LayerTheme radius="var(--radius-md)" gap="8px" padding="14px">
            <BlockHeading
              icon={selfState?.icon || "🟢"}
              title={`You're ${selfState?.short || "available"}`}
              action={
                selfAvailability.isDeclared ? (
                  <button
                    type="button"
                    onClick={() => selfAvailability.clear?.()}
                    className="app-btn app-btn--ghost"
                    style={{ padding: "2px 8px", minHeight: 0 }}
                  >
                    Reset
                  </button>
                ) : null
              }
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {selectableStates().map((state) => {
                const active = selfAvailability.effectiveId === state.id;
                return (
                  <button
                    key={state.id}
                    type="button"
                    onClick={() => selfAvailability.setAvailability?.(state.id)}
                    className={`app-btn ${active ? "app-btn--primary" : "app-btn--ghost"}`}
                    aria-pressed={active}
                    style={{ padding: "4px 10px", minHeight: 0, fontSize: "0.78rem" }}
                  >
                    <span aria-hidden="true" style={{ marginRight: 4 }}>{state.icon}</span>
                    {state.short}
                  </button>
                );
              })}
            </div>
          </LayerTheme>
        )}

        {/* 4.1 — My department presence, then other departments */}
        {myDept && myDept.total > 0 && <DepartmentGroup group={myDept} onNavigate={go} />}

        {/* 4.3 — Shared department activity */}
        <LayerTheme radius="var(--radius-md)" gap="6px" padding="14px">
          <BlockHeading icon="📡" title="Recent team activity" />
          {activity.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.55 }}>
              Live updates appear here as the floor moves — jobs completing, techs
              freeing up, appointments arriving.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activity.slice(0, WORKSPACE_LIMITS.panelActivity).map((item) => (
                <Row
                  key={item.seq ?? item.id}
                  tone={item.tone}
                  icon={item.icon}
                  label={item.text}
                  href={item.href}
                  onNavigate={go}
                />
              ))}
            </div>
          )}
        </LayerTheme>

        {/* 4.6 — Manager collaboration tools (manager-only) */}
        {managerTools.isManager &&
          managerTools.sections.map((section) => (
            <LayerTheme key={section.id} radius="var(--radius-md)" gap="6px" padding="14px">
              <BlockHeading icon={section.icon} title={section.title} />
              {section.items.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.55 }}>{section.emptyText}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {section.items.map((item) => (
                    <Row
                      key={item.id}
                      tone={item.tone}
                      label={item.label}
                      subtitle={item.subtitle}
                      href={item.href}
                      onNavigate={go}
                      messageHref={
                        item.memberId != null
                          ? memberContactAction(presence.byId?.get(item.memberId))?.href
                          : item.deptCode
                          ? audienceContactAction(item.deptCode, presence.departments)?.href
                          : null
                      }
                      messageLabel="Message"
                    />
                  ))}
                </div>
              )}
            </LayerTheme>
          ))}

        {/* 4.1 — Other departments (cross-team visibility) */}
        {otherDepts.length > 0 && (
          <>
            {otherDepts.map((group) => (
              <DepartmentGroup key={group.code} group={group} onNavigate={go} />
            ))}
          </>
        )}

        {/* 4.7 — Cross-department coordination */}
        {coordination.length > 0 && (
          <LayerTheme radius="var(--radius-md)" gap="6px" padding="14px">
            <BlockHeading icon="🔗" title="Coordinate across departments" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              {coordination.map((link) => (
                <Row
                  key={link.id}
                  tone="info"
                  icon="🔗"
                  label={link.label}
                  subtitle={link.subtitle}
                  href={link.href}
                  onNavigate={go}
                  messageHref={audienceContactAction(link.audience, presence.departments)?.href}
                  messageLabel={`Message the ${link.audience} team`}
                />
              ))}
            </div>
          </LayerTheme>
        )}
      </div>
    </PopupModal>
  );
}
