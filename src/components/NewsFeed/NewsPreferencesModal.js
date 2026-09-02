// file location: src/components/NewsFeed/NewsPreferencesModal.js
//
// Per-user notification and display preferences for the feed.
//
// Urgent announcements are deliberately NOT fully mutable — an urgent post is
// the one thing that always reaches you — and the copy says so rather than
// offering a switch that quietly does nothing.

import React, { useCallback, useEffect, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import { DropdownField, MultiSelectDropdown } from "@/components/ui/dropdownAPI";
import {
  AVAILABLE_DEPARTMENTS,
  CATEGORIES,
  DENSITY_COMFORTABLE,
  DENSITY_COMPACT,
  DIGEST_FREQUENCIES,
} from "@/lib/news/constants";
import { savePreferences } from "@/lib/api/news";
import { logFailure } from "@/lib/utils/logFailure";

const TOGGLES = [
  {
    key: "notifyAll",
    label: "New announcements",
    hint: "Anything published to one of your departments.",
  },
  {
    key: "notifyMentions",
    label: "When somebody @mentions me",
    hint: "In a post or in a comment.",
  },
  {
    key: "notifyAcknowledgements",
    label: "Acknowledgement requests",
    hint: "Posts that need you to confirm you have read them.",
  },
  {
    key: "notifyComments",
    label: "Comments on posts I wrote",
    hint: "",
  },
  {
    key: "notifySystemPosts",
    label: "Automated posts",
    hint: "Daily summaries and capacity alerts. Off by default.",
  },
];

const DENSITY_OPTIONS = [
  { value: DENSITY_COMFORTABLE, label: "Comfortable" },
  { value: DENSITY_COMPACT, label: "Compact" },
];

export default function NewsPreferencesModal({ isOpen, preferences, onClose, onSaved }) {
  const [form, setForm] = useState(preferences || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setForm(preferences || {});
      setError("");
    }
  }, [isOpen, preferences]);

  const setField = useCallback((field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const saved = await savePreferences(form);
      onSaved?.(saved);
      onClose?.();
    } catch (saveError) {
      logFailure("Failed to save notification preferences:", saveError);
      setError(saveError.message || "We could not save your preferences.");
    } finally {
      setSaving(false);
    }
  }, [form, onClose, onSaved]);

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop={!saving}
      ariaLabel="News notification preferences"
      cardStyle={{
        width: "min(100%, 640px)",
        maxHeight: "88vh",
        overflowY: "auto",
        padding: "var(--page-card-padding)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)" }}>
        <header className="app-popup-compact-header">
          <h3>Notifications & view</h3>
          <div className="app-popup-compact-header__actions">
            <Button type="button" variant="primary" size="sm" busy={saving} onClick={save}>
              Save
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
          </div>
        </header>

        <LayerTheme gap="var(--space-3)">
          <strong>Tell me about</strong>
          {TOGGLES.map((toggle) => (
            <label
              key={toggle.key}
              htmlFor={`news-pref-${toggle.key}`}
              style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-sm)" }}
            >
              <input
                id={`news-pref-${toggle.key}`}
                className="app-toggle app-toggle--checkbox"
                type="checkbox"
                checked={Boolean(form[toggle.key])}
                onChange={(event) => setField(toggle.key, event.target.checked)}
              />
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span>{toggle.label}</span>
                {toggle.hint && <span className="app-news-composer__hint">{toggle.hint}</span>}
              </span>
            </label>
          ))}
          <span className="app-news-composer__hint">
            Urgent announcements always reach you, whatever else is switched off here.
          </span>
        </LayerTheme>

        <LayerTheme gap="var(--space-3)">
          <strong>Mute</strong>
          <MultiSelectDropdown
            id="news-pref-muted-categories"
            label="Categories to mute"
            placeholder="Nothing muted"
            searchPlaceholder="Search categories"
            options={CATEGORIES.map((category) => ({
              value: category.value,
              label: category.label,
            }))}
            value={form.mutedCategories || []}
            onChange={(value) => setField("mutedCategories", value)}
            emptyState="No categories"
            maxHeight="200px"
            usePortal
          />
          <MultiSelectDropdown
            id="news-pref-muted-departments"
            label="Departments to mute"
            placeholder="Nothing muted"
            searchPlaceholder="Search departments"
            options={AVAILABLE_DEPARTMENTS}
            value={form.mutedDepartments || []}
            onChange={(value) => setField("mutedDepartments", value)}
            emptyState="No departments"
            maxHeight="200px"
            usePortal
          />
          <span className="app-news-composer__hint">
            Muting hides notifications, not the posts themselves — they still appear in the feed.
          </span>
        </LayerTheme>

        <div className="app-news-composer__grid">
          <DropdownField
            id="news-pref-digest"
            label="How often"
            options={DIGEST_FREQUENCIES}
            value={form.digestFrequency || "realtime"}
            onValueChange={(value) => setField("digestFrequency", value)}
          />
          <DropdownField
            id="news-pref-density"
            label="Feed view"
            options={DENSITY_OPTIONS}
            value={form.feedDensity || DENSITY_COMFORTABLE}
            onValueChange={(value) => setField("feedDensity", value)}
          />
        </div>

        {error && (
          <div className="app-status-message app-status-message--danger" role="alert">
            {error}
          </div>
        )}
      </div>
    </PopupModal>
  );
}
