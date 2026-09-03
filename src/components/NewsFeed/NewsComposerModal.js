// file location: src/components/NewsFeed/NewsComposerModal.js
//
// The announcement composer — create and edit.
//
// Everything a hub post can carry lives here: audience, category, priority,
// required acknowledgement (with a due date), scheduling, expiry, attachments,
// @mentions and links to real DMS records.
//
// Attachments are uploaded BEFORE the post exists, filed against a generated
// draft key, and claimed by the post on save — so a composer that is cancelled
// leaves the feed untouched.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import LayerTheme from "@/components/ui/LayerTheme";
import { DropdownField, MultiSelectDropdown } from "@/components/ui/dropdownAPI";
import MentionTextarea from "./MentionTextarea";
import NewsAttachments from "./NewsAttachments";
import NewsRecordLinks from "./NewsRecordLinks";
import {
  ATTACHMENT_MAX_PER_POST,
  AVAILABLE_DEPARTMENTS,
  CATEGORIES,
  LINK_TYPES,
  PRIORITIES,
  STATUS_DRAFT,
  STATUS_PUBLISHED,
} from "@/lib/news/constants";
import {
  createNewsPost,
  deleteAttachment,
  fetchDraftAttachments,
  updateNewsPost,
  uploadAttachment,
} from "@/lib/api/news";
import { logFailure } from "@/lib/utils/logFailure";

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time; the API speaks ISO.
const toLocalInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

const emptyForm = {
  title: "",
  content: "",
  departments: [],
  category: "announcement",
  priority: "normal",
  requiresAck: false,
  ackDueAt: "",
  publishAt: "",
  expiresAt: "",
  links: [],
};

const buildDraftKey = () =>
  `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function NewsComposerModal({
  isOpen,
  post = null,
  canDelete = false,
  deleting = false,
  onDelete,
  onClose,
  onSaved,
}) {
  const isEditing = Boolean(post?.id);

  const [form, setForm] = useState(emptyForm);
  const [draftKey, setDraftKey] = useState(buildDraftKey);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [linkDraft, setLinkDraft] = useState({ recordType: "job_card", recordId: "", label: "" });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInputRef = useRef(null);

  // Seed the form whenever the modal opens, so reopening never shows the last
  // post's wording.
  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setConfirmingDelete(false);
    setDraftKey(buildDraftKey());
    setLinkDraft({ recordType: "job_card", recordId: "", label: "" });

    if (post) {
      setForm({
        title: post.title || "",
        content: post.content || "",
        departments: post.departments || [],
        category: post.category || "announcement",
        priority: post.priority || "normal",
        requiresAck: Boolean(post.requiresAck),
        ackDueAt: toLocalInput(post.ackDueAt),
        publishAt: toLocalInput(post.publishAt),
        expiresAt: toLocalInput(post.expiresAt),
        links: post.links || [],
      });
      setAttachments(post.attachments || []);
    } else {
      setForm(emptyForm);
      setAttachments([]);
    }
  }, [isOpen, post]);

  const setField = useCallback((field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  }, []);

  const refreshDraftAttachments = useCallback(async () => {
    try {
      const rows = await fetchDraftAttachments(draftKey);
      // In edit mode the post's existing files stay listed alongside the new
      // ones, which are still parked on the draft key until save.
      setAttachments((existing) => {
        const kept = existing.filter((item) => item.postId);
        return [...kept, ...(rows || [])];
      });
    } catch (loadError) {
      logFailure("Failed to load draft attachments:", loadError);
    }
  }, [draftKey]);

  const handleUpload = useCallback(
    async (event) => {
      const files = Array.from(event.target.files || []);
      event.target.value = "";
      if (!files.length) return;

      if (attachments.length + files.length > ATTACHMENT_MAX_PER_POST) {
        setError(`An announcement can carry at most ${ATTACHMENT_MAX_PER_POST} attachments.`);
        return;
      }

      setUploading(true);
      setError("");
      try {
        for (const file of files) {
          await uploadAttachment({ file, draftKey });
        }
        await refreshDraftAttachments();
      } catch (uploadError) {
        logFailure("Failed to upload an attachment:", uploadError);
        setError(uploadError.message || "We could not upload that file.");
      } finally {
        setUploading(false);
      }
    },
    [attachments.length, draftKey, refreshDraftAttachments]
  );

  const handleRemoveAttachment = useCallback(async (attachment) => {
    setRemovingId(attachment.id);
    try {
      await deleteAttachment(attachment.id);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    } catch (removeError) {
      logFailure("Failed to remove the attachment:", removeError);
      setError(removeError.message || "We could not remove that file.");
    } finally {
      setRemovingId(null);
    }
  }, []);

  const addLink = useCallback(() => {
    const recordId = linkDraft.recordId.trim();
    if (!recordId) return;
    setForm((previous) => ({
      ...previous,
      links: [
        ...previous.links,
        {
          recordType: linkDraft.recordType,
          recordId,
          label: linkDraft.label.trim() || undefined,
        },
      ],
    }));
    setLinkDraft((previous) => ({ ...previous, recordId: "", label: "" }));
  }, [linkDraft]);

  const removeLink = useCallback((_link, index) => {
    setForm((previous) => ({
      ...previous,
      links: previous.links.filter((_, position) => position !== index),
    }));
  }, []);

  const save = useCallback(
    async (status) => {
      setError("");
      if (!form.title.trim() || !form.content.trim()) {
        setError("Give the announcement a title and a description.");
        return;
      }
      if (form.departments.length === 0) {
        setError("Choose at least one department, or pick General for everyone.");
        return;
      }

      setSaving(true);
      try {
        const payload = {
          title: form.title.trim(),
          content: form.content.trim(),
          departments: form.departments,
          category: form.category,
          priority: form.priority,
          requiresAck: form.requiresAck,
          ackDueAt: form.requiresAck ? fromLocalInput(form.ackDueAt) : null,
          publishAt: fromLocalInput(form.publishAt),
          expiresAt: fromLocalInput(form.expiresAt),
          links: form.links,
          draftKey,
          status,
        };

        const saved = isEditing
          ? await updateNewsPost(post.id, payload)
          : await createNewsPost(payload);

        onSaved?.(saved);
        onClose?.();
      } catch (saveError) {
        logFailure("Failed to save the announcement:", saveError);
        setError(saveError.message || "We could not save that announcement.");
      } finally {
        setSaving(false);
      }
    },
    [draftKey, form, isEditing, onClose, onSaved, post?.id]
  );

  const linkTypeOptions = useMemo(
    () => LINK_TYPES.map((type) => ({ value: type.value, label: type.label })),
    []
  );
  const activeLinkType = LINK_TYPES.find((type) => type.value === linkDraft.recordType);

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop={!saving}
      ariaLabel={isEditing ? "Edit announcement" : "New announcement"}
      cardStyle={{
        width: "min(100%, 820px)",
        maxHeight: "88vh",
        overflowY: "auto",
        padding: "var(--page-card-padding)",
      }}
    >
      <div className="app-news-composer">
        <header className="app-popup-compact-header">
          <h3>{isEditing ? "Edit announcement" : "New announcement"}</h3>
          <div className="app-popup-compact-header__actions">
            <Button
              type="button"
              variant="primary"
              size="sm"
              busy={saving}
              onClick={() => save(STATUS_PUBLISHED)}
            >
              {form.publishAt ? "Schedule" : "Publish"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => save(STATUS_DRAFT)}
            >
              Save draft
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            {/* Delete lives here rather than on the feed row: it is only ever
                reachable by someone who can already edit the announcement. */}
            {isEditing && canDelete && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                busy={deleting}
                disabled={saving}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </Button>
            )}
          </div>
        </header>

        <InputField
          id="news-title"
          label="Title"
          type="text"
          placeholder="What is this announcement about?"
          value={form.title}
          onChange={(event) => setField("title", event.target.value)}
          required
        />

        <div className="app-news-composer__field">
          <label htmlFor="news-content">Description</label>
          <MentionTextarea
            id="news-content"
            value={form.content}
            onChange={(value) => setField("content", value)}
            rows={7}
            placeholder="Write the update. Type @ to mention a colleague."
            ariaLabel="Announcement description"
          />
          <span className="app-news-composer__hint">
            Mentioned colleagues get this in their Mentions filter.
          </span>
        </div>

        <div className="app-news-composer__grid">
          <MultiSelectDropdown
            id="news-departments"
            label="Visible to departments"
            searchPlaceholder="Search departments"
            placeholder="Select departments"
            options={AVAILABLE_DEPARTMENTS}
            value={form.departments}
            onChange={(value) => setField("departments", value)}
            emptyState="No departments available"
            maxHeight="220px"
            usePortal
          />

          <DropdownField
            id="news-category"
            label="Category"
            options={CATEGORIES.map((category) => ({
              value: category.value,
              label: category.label,
            }))}
            value={form.category}
            onValueChange={(value) => setField("category", value)}
          />

          <DropdownField
            id="news-priority"
            label="Priority"
            options={PRIORITIES.map((priority) => ({
              value: priority.value,
              label: priority.label,
              description: priority.description,
            }))}
            value={form.priority}
            onValueChange={(value) => setField("priority", value)}
          />
        </div>

        <LayerTheme gap="var(--space-3)">
          <div className="app-news-composer__row">
            <label
              htmlFor="news-requires-ack"
              style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-sm)" }}
            >
              <input
                id="news-requires-ack"
                className="app-toggle app-toggle--checkbox"
                type="checkbox"
                checked={form.requiresAck}
                onChange={(event) => setField("requiresAck", event.target.checked)}
              />
              Require an acknowledgement
            </label>

            {form.requiresAck && (
              <div className="app-news-composer__field" style={{ flex: "1 1 220px" }}>
                <label htmlFor="news-ack-due">Acknowledge by</label>
                <input
                  id="news-ack-due"
                  className="app-input"
                  type="datetime-local"
                  value={form.ackDueAt}
                  onChange={(event) => setField("ackDueAt", event.target.value)}
                />
              </div>
            )}
          </div>

          <span className="app-news-composer__hint">
            Everyone in the target departments is asked to acknowledge it, and you can track who
            still has not from the post itself.
          </span>
        </LayerTheme>

        <div className="app-news-composer__grid">
          <div className="app-news-composer__field">
            <label htmlFor="news-publish-at">Publish at (optional)</label>
            <input
              id="news-publish-at"
              className="app-input"
              type="datetime-local"
              value={form.publishAt}
              onChange={(event) => setField("publishAt", event.target.value)}
            />
            <span className="app-news-composer__hint">
              Leave blank to publish immediately.
            </span>
          </div>

          <div className="app-news-composer__field">
            <label htmlFor="news-expires-at">Expires (optional)</label>
            <input
              id="news-expires-at"
              className="app-input"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) => setField("expiresAt", event.target.value)}
            />
            <span className="app-news-composer__hint">
              The post is archived automatically once it expires.
            </span>
          </div>
        </div>

        <LayerTheme gap="var(--space-3)">
          <strong>Attachments</strong>
          <NewsAttachments
            attachments={attachments}
            onRemove={handleRemoveAttachment}
            removingId={removingId}
          />
          <div className="app-news-composer__row">
            {/* The native file input is hidden and driven by an app button —
                the browser's own "Choose file" control cannot be themed. */}
            <input
              id="news-attachment-input"
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={handleUpload}
              aria-label="Attach files to this announcement"
            />
            <Button
              type="button"
              variant="secondary"
              size="xxs"
              busy={uploading}
              disabled={attachments.length >= ATTACHMENT_MAX_PER_POST}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose files
            </Button>
            <span className="app-news-composer__hint">
              {attachments.length >= ATTACHMENT_MAX_PER_POST
                ? `Limit of ${ATTACHMENT_MAX_PER_POST} attachments reached.`
                : uploading
                  ? "Uploading…"
                  : "PNG, JPG, PDF and documents."}
            </span>
          </div>
        </LayerTheme>

        <LayerTheme gap="var(--space-3)">
          <strong>Link to DMS records</strong>
          <NewsRecordLinks links={form.links} onRemove={removeLink} />
          <div className="app-news-composer__row">
            <div style={{ flex: "0 1 200px", minWidth: 0 }}>
              <DropdownField
                id="news-link-type"
                label="Record type"
                options={linkTypeOptions}
                value={linkDraft.recordType}
                onValueChange={(value) =>
                  setLinkDraft((previous) => ({ ...previous, recordType: value }))
                }
              />
            </div>
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <InputField
                id="news-link-id"
                label="Reference"
                type="text"
                placeholder={activeLinkType?.placeholder || "Reference"}
                value={linkDraft.recordId}
                onChange={(event) =>
                  setLinkDraft((previous) => ({ ...previous, recordId: event.target.value }))
                }
              />
            </div>
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <InputField
                id="news-link-label"
                label="Label (optional)"
                type="text"
                placeholder="Shown on the post"
                value={linkDraft.label}
                onChange={(event) =>
                  setLinkDraft((previous) => ({ ...previous, label: event.target.value }))
                }
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addLink}
              disabled={!linkDraft.recordId.trim()}
            >
              Add link
            </Button>
          </div>
        </LayerTheme>

        {error && (
          <div className="app-status-message app-status-message--danger" role="alert">
            {error}
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={confirmingDelete}
        title="Delete announcement"
        message={`Delete "${post?.title || "this announcement"}"?`}
        description="It is removed from everyone's feed. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete?.(post);
          onClose?.();
        }}
      />
    </PopupModal>
  );
}
