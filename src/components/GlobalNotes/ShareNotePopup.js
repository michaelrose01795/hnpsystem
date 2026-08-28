// file location: src/components/GlobalNotes/ShareNotePopup.js
//
// The "Share note" popup for the floating notes widget.
//
// Extracted out of GlobalNotesWidget.js (1,500+ lines, which made this popup
// genuinely hard to find and edit). Everything the popup owns lives here:
// its markup, its search state and its styles.
//
// Contract with the parent (GlobalNotesWidget):
//   - The parent renders this ONLY while the share modal is open. Closing it
//     unmounts the component, so the search box resets on its own — the parent
//     does not track or clear it.
//   - The parent owns the note, the candidate list, the selection and the
//     persistence; this component is presentational plus local search.
//
// Styling note: see the SPECIFICITY CONTRACT at the top of the matching
// .module.css. Bare-element rules in staffglobal.css outrank single-class
// module selectors, so rows are styled through two-class selectors.

import React, { useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import LayerTheme from "@/components/ui/LayerTheme";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";
import SearchBar from "@/components/ui/searchBarAPI/SearchBar";
import StatusMessage from "@/components/ui/StatusMessage";
import styles from "@/components/GlobalNotes/ShareNotePopup.module.css";

// Share remains compact while inheriting the canonical popup shell and
// responsive behavior.
const SHARE_POPUP_CARD_STYLE = {
  width: "min(100%, 520px)",
  maxWidth: "520px",
  padding: "var(--page-card-padding)",
  overflow: "hidden",
  boxSizing: "border-box",
};

export const getShareUserDisplayName = (userRow) => {
  const fullName = `${userRow.firstName || ""} ${userRow.lastName || ""}`.replace(/\s+/g, " ").trim();
  return fullName || userRow.email || `User ${userRow.userId}`;
};

export default function ShareNotePopup({
  users = [],
  selectedUserIds = [],
  isLoading = false,
  isSaving = false,
  error = "",
  onToggleUser,
  onClose,
}) {
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((userRow) => {
      const fullName = `${userRow.firstName || ""} ${userRow.lastName || ""}`.trim().toLowerCase();
      const email = String(userRow.email || "").toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
  }, [users, search]);

  return (
    <PopupModal
      isOpen
      onClose={onClose}
      closeOnBackdrop={!isSaving}
      ariaLabel="Share note"
      cardStyle={SHARE_POPUP_CARD_STYLE}
    >
      <div className={styles.root}>
        <header className="app-popup-compact-header">
          <h2>Share note</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
              Close
            </Button>
          </div>
        </header>

        {error && <StatusMessage tone="danger">{error}</StatusMessage>}

        <div className={`app-layout-toolbar-row ${styles.toolbar}`}>
          <SearchBar
            type="search"
            className={styles.search}
            placeholder="Search by name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            ariaLabel="Search colleagues"
            disabled={isLoading}
          />
          {/* Doubles as the save indicator — the list itself carries no header. */}
          <span className={`app-badge app-badge--accent-soft ${styles.selectedCount}`} aria-live="polite">
            {isSaving ? "Saving…" : `${selectedUserIds.length} of ${users.length} selected`}
          </span>
        </div>

        <LayerTheme className={styles.listSection} radius="var(--radius-sm)" padding="0" gap="0">
          <div
            className={`${styles.list} themed-scrollbar`}
            role="group"
            aria-label="Colleagues"
            aria-busy={isLoading ? "true" : "false"}
          >
            {isLoading && (
              <div className={styles.loading}>
                <InlineLoading label="Loading colleagues" width={132} />
              </div>
            )}
            {!isLoading && filteredUsers.length === 0 && (
              <EmptyState
                variant="bare"
                role="status"
                title={search ? "No matching colleagues" : "No colleagues available"}
                description={
                  search
                    ? "Try a different name or email address."
                    : "There is nobody else available to share this note with."
                }
              />
            )}
            {!isLoading &&
              filteredUsers.map((userRow) => {
                const isSelected = selectedUserIds.includes(userRow.userId);
                const displayName = getShareUserDisplayName(userRow);
                return (
                  <label
                    key={userRow.userId}
                    className={styles.row}
                    data-selected={isSelected ? "true" : undefined}
                  >
                    <input
                      type="checkbox"
                      className="app-toggle app-toggle--checkbox"
                      checked={isSelected}
                      onChange={() => onToggleUser?.(userRow.userId)}
                      disabled={isLoading || isSaving}
                      aria-label={`Share note with ${displayName}`}
                      title={`Share note with ${displayName}`}
                    />
                    <span className={styles.name}>{displayName}</span>
                  </label>
                );
              })}
          </div>
        </LayerTheme>
      </div>
    </PopupModal>
  );
}
