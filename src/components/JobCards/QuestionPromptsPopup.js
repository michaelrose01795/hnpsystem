// file location: src/components/JobCards/QuestionPromptsPopup.js
// "Question Prompts" popup — shows a small, relevant set of questions a
// service advisor can ask the customer on the phone based on the request
// text they typed into the Job Requests section on /job-cards/create.
//
// Design notes:
//   - Uses the existing popupOverlayStyles / popupCardStyles from
//     src/styles/appTheme.js so the shell matches every other popup on the
//     page (e.g. the "detected requests" popup in the same file).
//   - Questions are grouped by category when multiple issue types are
//     detected in the same request text.
//   - Advisors can tick questions off as they ask them (local-only state,
//     so ticks don't persist — they're just a live call aid).
//   - Mobile friendly: layout uses flex-wrap + full-width buttons, and
//     the card itself already adapts via popupCardStyles.

import React, { useMemo, useState } from "react";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import { generateQuestionsFromRequest } from "@/lib/ai/questionPrompts";

export default function QuestionPromptsPopup({
  open = false,
  onClose = () => {},
  requestText = "",
  requestIndex = null,
}) {
  // Run the engine once per popup open. Memoised against requestText so the
  // question list is stable while the popup is on screen.
  const result = useMemo(
    () => generateQuestionsFromRequest(requestText),
    [requestText]
  );

  // Local-only "ticked" state so the advisor can visually cross off
  // questions as they ask them. Reset every time the popup opens/closes.
  const [ticked, setTicked] = useState({});

  if (!open) return null;

  // Unique key per question used to track tick state across groups.
  const toggleKey = (groupId, qIndex) => `${groupId}::${qIndex}`;
  const toggleTick = (groupId, qIndex) => {
    const key = toggleKey(groupId, qIndex);
    setTicked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const totalQuestions = result.groups.reduce(
    (sum, g) => sum + g.questions.length,
    0
  );

  return (
    <div
      style={popupOverlayStyles}
      onClick={(event) => {
        // Clicking the dim backdrop closes the popup, clicking the card
        // itself does not (stopPropagation on the card below).
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Question prompts for customer call"
    >
      <div
        style={{
          ...popupCardStyles,
          width: "100%",
          maxWidth: "640px",
          maxHeight: "88vh",
          overflowY: "auto",
          border: "none",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ padding: "28px" }}>
          {/* Header: title + close button — mirrors the detected-requests popup */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "var(--primary)",
                  letterSpacing: "0.02em",
                }}
              >
                Question Prompts
                {requestIndex !== null ? (
                  <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                    {" "}
                    · Request {Number(requestIndex) + 1}
                  </span>
                ) : null}
              </h3>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                {result.isFallback
                  ? "No strong match — general questions to get started."
                  : `${totalQuestions} suggested ${totalQuestions === 1 ? "question" : "questions"} to ask the customer.`}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "22px",
                lineHeight: 1,
                color: "var(--info)",
              }}
              aria-label="Close question prompts popup"
            >
              ×
            </button>
          </div>

          {/* Request text echo — helps the advisor keep context on the call */}
          {requestText ? (
            <div
              style={{
                fontSize: "13px",
                color: "var(--text-primary)",
                backgroundColor: "var(--surface-light)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                marginBottom: "16px",
                whiteSpace: "pre-wrap",
              }}
            >
              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Request:</span>{" "}
              {requestText}
            </div>
          ) : null}

          {/* Matched category pills — only when there's a real match, to
              make it obvious why these questions were chosen. */}
          {!result.isFallback && result.matchedCategories.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                marginBottom: "14px",
              }}
            >
              {result.matchedCategories.map((cat) => (
                <span
                  key={`matched-${cat.id}`}
                  className="app-btn app-btn--secondary app-btn--xs app-btn--pill"
                  style={{ pointerEvents: "none" }}
                >
                  {cat.label}
                </span>
              ))}
            </div>
          ) : null}

          {/* Question groups */}
          <div style={{ display: "grid", gap: "12px" }}>
            {result.groups.map((group) => (
              <div
                key={group.id}
                style={{
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--surface-light)",
                  padding: "14px 16px",
                  display: "grid",
                  gap: "10px",
                }}
              >
                {/* Group heading only shown when we have more than one group, or
                    when this is the fallback set — single matched category is
                    already reflected in the header pill. */}
                {(result.groups.length > 1 || result.isFallback) ? (
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {group.label}
                  </div>
                ) : null}

                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "grid",
                    gap: "8px",
                  }}
                >
                  {group.questions.map((q, qIndex) => {
                    const key = toggleKey(group.id, qIndex);
                    const isTicked = !!ticked[key];
                    return (
                      <li key={`${group.id}-${qIndex}`}>
                        <button
                          type="button"
                          onClick={() => toggleTick(group.id, qIndex)}
                          // min-height 44px satisfies the touch-target rule in CLAUDE.md §3.6
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "10px",
                            width: "100%",
                            minHeight: "44px",
                            textAlign: "left",
                            padding: "10px 12px",
                            borderRadius: "var(--radius-xs)",
                            border: "none",
                            background: isTicked
                              ? "var(--accent-surface-hover)"
                              : "var(--surface)",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                            fontSize: "13px",
                            lineHeight: 1.45,
                            transition: "background-color 0.15s",
                          }}
                          aria-pressed={isTicked}
                        >
                          {/* Tick indicator — uses accent colour when asked */}
                          <span
                            aria-hidden="true"
                            style={{
                              flex: "0 0 18px",
                              width: "18px",
                              height: "18px",
                              marginTop: "1px",
                              borderRadius: "var(--radius-xs)",
                              border: isTicked
                                ? "none"
                                : "1.5px solid var(--border)",
                              background: isTicked ? "var(--primary)" : "transparent",
                              color: "var(--onAccentText, #fff)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              fontWeight: 700,
                            }}
                          >
                            {isTicked ? "✓" : ""}
                          </span>
                          <span
                            style={{
                              textDecoration: isTicked ? "line-through" : "none",
                              opacity: isTicked ? 0.7 : 1,
                            }}
                          >
                            {q}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Footer: single close affordance — avoids clutter, matches the
              other popups on this page which also only offer a close/× */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "18px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="app-btn app-btn--secondary"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
