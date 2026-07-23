// file location: src/components/JobCards/QuestionPromptsPopup.js

import React, { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import PopupModal from "@/components/popups/popupStyleApi";
import { generateQuestionsFromRequest } from "@/lib/ai/questionPrompts";

export default function QuestionPromptsPopup({
  open = false,
  onClose = () => {},
  requestText = "",
  requestIndex = null,
}) {
  const result = useMemo(
    () => generateQuestionsFromRequest(requestText),
    [requestText]
  );
  const [ticked, setTicked] = useState({});

  if (!open) return null;

  const toggleKey = (groupId, questionIndex) => `${groupId}::${questionIndex}`;
  const toggleTick = (groupId, questionIndex) => {
    const key = toggleKey(groupId, questionIndex);
    setTicked((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  const totalQuestions = result.groups.reduce(
    (sum, group) => sum + group.questions.length,
    0
  );

  return (
    <PopupModal
      isOpen
      onClose={onClose}
      ariaLabel="Question prompts for customer call"
      cardStyle={{ width: "100%", maxWidth: "640px" }}
    >
      <div style={{ padding: "28px", display: "grid", gap: "16px" }}>
        <div className="app-popup-compact-header">
          <div>
            <h3>
              Question Prompts
              {requestIndex !== null ? ` · Request ${Number(requestIndex) + 1}` : ""}
            </h3>
            <span>
              {result.isFallback
                ? "No strong match — general questions to get started."
                : `${totalQuestions} suggested ${totalQuestions === 1 ? "question" : "questions"} to ask the customer.`}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="app-btn--icon"
            onClick={onClose}
            aria-label="Close question prompts popup"
          >
            ×
          </Button>
        </div>

        {requestText ? (
          <LayerTheme radius="var(--radius-sm)" padding="10px 12px">
            <span>
              <strong>Request:</strong> {requestText}
            </span>
          </LayerTheme>
        ) : null}

        {!result.isFallback && result.matchedCategories.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {result.matchedCategories.map((category) => (
              <span key={`matched-${category.id}`} className="app-badge app-badge--accent-soft">
                {category.label}
              </span>
            ))}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: "12px" }}>
          {result.groups.map((group) => (
            <LayerTheme key={group.id} radius="var(--radius-sm)" padding="14px 16px">
              {result.groups.length > 1 || result.isFallback ? <strong>{group.label}</strong> : null}
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "grid",
                  gap: "8px",
                }}
              >
                {group.questions.map((question, questionIndex) => {
                  const key = toggleKey(group.id, questionIndex);
                  const isTicked = Boolean(ticked[key]);
                  return (
                    <li key={`${group.id}-${questionIndex}`}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          minHeight: "44px",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          className="app-toggle app-toggle--checkbox"
                          checked={isTicked}
                          onChange={() => toggleTick(group.id, questionIndex)}
                        />
                        <span style={{ textDecoration: isTicked ? "line-through" : "none" }}>
                          {question}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </LayerTheme>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </PopupModal>
  );
}
