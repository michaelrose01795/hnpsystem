import React, { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useConfirmation } from "@/context/ConfirmationContext";
import { normalizeRoles } from "@/lib/auth/roles";
import {
  createFloatingNote,
  deleteFloatingNote,
  getFloatingNotesForUser,
  updateFloatingNote,
} from "@/lib/database/floatingNotes";
import styles from "@/components/GlobalNotesWidget.module.css";

const BUBBLE_SIZE = 56;
const PANEL_DEFAULT = { x: 120, y: 90, width: 460, height: 360 };
const PANEL_CLOSE_ANIMATION_MS = 150;
const SAVE_DEBOUNCE_MS = 520;
const DRAG_START_THRESHOLD = 4;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getPanelMinWidth = () => (typeof window !== "undefined" && window.innerWidth <= 480 ? 260 : 320);
const getPanelMinHeight = () => (typeof window !== "undefined" && window.innerWidth <= 480 ? 220 : 260);

const clampBubble = (position) => {
  if (typeof window === "undefined") return position;
  const maxX = Math.max(0, window.innerWidth - BUBBLE_SIZE);
  const maxY = Math.max(0, window.innerHeight - BUBBLE_SIZE);
  return {
    x: clamp(position.x, 0, maxX),
    y: clamp(position.y, 0, maxY),
  };
};

const projectToNearestEdge = (position) => {
  if (typeof window === "undefined") return position;

  const maxX = Math.max(0, window.innerWidth - BUBBLE_SIZE);
  const maxY = Math.max(0, window.innerHeight - BUBBLE_SIZE);
  const current = clampBubble(position);

  const distances = {
    left: current.x,
    right: maxX - current.x,
    top: current.y,
    bottom: maxY - current.y,
  };

  let nearest = "left";
  for (const side of Object.keys(distances)) {
    if (distances[side] < distances[nearest]) nearest = side;
  }

  if (nearest === "left") return { x: 0, y: current.y };
  if (nearest === "right") return { x: maxX, y: current.y };
  if (nearest === "top") return { x: current.x, y: 0 };
  return { x: current.x, y: maxY };
};

const getDefaultBubblePosition = () => {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return {
    x: window.innerWidth - BUBBLE_SIZE - 12,
    y: window.innerHeight - BUBBLE_SIZE - 12,
  };
};

const clampPanelRect = (rect) => {
  if (typeof window === "undefined") return rect;

  const minWidth = getPanelMinWidth();
  const minHeight = getPanelMinHeight();
  const maxWidth = Math.max(minWidth, window.innerWidth - 16);
  const maxHeight = Math.max(minHeight, window.innerHeight - 16);
  const width = clamp(rect.width, minWidth, maxWidth);
  const height = clamp(rect.height, minHeight, maxHeight);

  const maxX = Math.max(8, window.innerWidth - width - 8);
  const maxY = Math.max(8, window.innerHeight - height - 8);

  return {
    width,
    height,
    x: clamp(rect.x, 8, maxX),
    y: clamp(rect.y, 8, maxY),
  };
};

const getDefaultPanelRect = () => {
  if (typeof window === "undefined") return PANEL_DEFAULT;
  const width = Math.min(PANEL_DEFAULT.width, window.innerWidth - 24);
  const height = Math.min(PANEL_DEFAULT.height, window.innerHeight - 24);
  return {
    width,
    height,
    x: clamp(window.innerWidth - width - 20, 8, Math.max(8, window.innerWidth - width - 8)),
    y: clamp(window.innerHeight - height - 20, 8, Math.max(8, window.innerHeight - height - 8)),
  };
};

const hasOpenModal = () => {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.body.classList.contains("modal-open") ||
      document.querySelector(".popup-backdrop, [aria-modal='true'], [data-modal-portal='true']")
  );
};

export default function GlobalNotesWidget() {
  const { dbUserId, user } = useUser() || {};
  const { confirm } = useConfirmation();
  const [bubblePosition, setBubblePosition] = useState(getDefaultBubblePosition);
  const [panelRect, setPanelRect] = useState(getDefaultPanelRect);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [isPanelMounted, setIsPanelMounted] = useState(false);
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [error, setError] = useState("");

  const notesRef = useRef([]);
  const panelRectRef = useRef(panelRect);
  const bubbleDragRef = useRef(null);
  const panelDragRef = useRef(null);
  const panelResizeRef = useRef(null);
  const pointerMovedRef = useRef(false);
  const closePanelTimerRef = useRef(null);
  const saveTimersRef = useRef(new Map());
  const resizeTimerRef = useRef(null);

  const roleNames = useMemo(() => normalizeRoles(user?.roles || []), [user?.roles]);
  const isDevSession = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.localStorage.getItem("devUser"));
  }, [user?.id]);

  const canManageGlobalNotes =
    isDevSession ||
    roleNames.includes("admin") ||
    roleNames.includes("admin manager") ||
    roleNames.includes("owner") ||
    roleNames.includes("developer") ||
    roleNames.includes("dev");

  const storageSuffix = useMemo(() => {
    const numericUserId = Number(dbUserId);
    if (Number.isInteger(numericUserId)) return String(numericUserId);
    return user?.id ? String(user.id) : "anon";
  }, [dbUserId, user?.id]);

  const bubbleStorageKey = `hnp-floating-notes-bubble-${storageSuffix}`;
  const panelStorageKey = `hnp-floating-notes-panel-${storageSuffix}`;

  const activeNote = useMemo(
    () => notes.find((note) => note.noteId === activeNoteId) || null,
    [notes, activeNoteId]
  );

  const activeNoteOwnedByUser = Boolean(activeNote && Number(activeNote.userId) === Number(dbUserId));
  const activeNoteReadOnly = !activeNoteOwnedByUser;

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    panelRectRef.current = panelRect;
  }, [panelRect]);

  const persistBubblePosition = (position) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(bubbleStorageKey, JSON.stringify(position));
  };

  const persistPanelRect = (rect) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(panelStorageKey, JSON.stringify(rect));
  };

  const loadNotes = async () => {
    const numericUserId = Number(dbUserId);
    if (!Number.isInteger(numericUserId)) {
      setNotes([]);
      setActiveNoteId(null);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const rows = await getFloatingNotesForUser(numericUserId);
      setNotes(rows);
      setActiveNoteId((current) => {
        if (rows.length === 0) return null;
        if (current && rows.some((row) => row.noteId === current)) return current;
        return rows[0].noteId;
      });
    } catch (loadError) {
      setError(loadError?.message || "Failed to load notes");
    } finally {
      setIsLoading(false);
    }
  };

  const flushSave = async (noteId, payload) => {
    const pending = saveTimersRef.current.get(noteId);
    if (pending) {
      clearTimeout(pending);
      saveTimersRef.current.delete(noteId);
    }

    setSaveStatus("saving");
    const result = await updateFloatingNote(noteId, payload);
    if (!result.success) {
      setSaveStatus("error");
      setError(result.error?.message || "Failed to save note");
      return;
    }

    setNotes((prev) => prev.map((row) => (row.noteId === noteId ? { ...row, ...result.data } : row)));
    setSaveStatus("saved");
  };

  const scheduleSave = (noteId, payload) => {
    const pending = saveTimersRef.current.get(noteId);
    if (pending) clearTimeout(pending);

    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      saveTimersRef.current.delete(noteId);
      const result = await updateFloatingNote(noteId, payload);
      if (!result.success) {
        setSaveStatus("error");
        setError(result.error?.message || "Failed to save note");
        return;
      }
      setNotes((prev) => prev.map((row) => (row.noteId === noteId ? { ...row, ...result.data } : row)));
      setSaveStatus("saved");
    }, SAVE_DEBOUNCE_MS);

    saveTimersRef.current.set(noteId, timer);
  };

  const openPanel = () => {
    if (closePanelTimerRef.current) {
      clearTimeout(closePanelTimerRef.current);
      closePanelTimerRef.current = null;
    }
    setIsPanelMounted(true);
    requestAnimationFrame(() => setIsPanelVisible(true));
  };

  const closePanel = () => {
    setIsPanelVisible(false);
    closePanelTimerRef.current = setTimeout(() => {
      setIsPanelMounted(false);
      closePanelTimerRef.current = null;
    }, PANEL_CLOSE_ANIMATION_MS);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedBubble = window.localStorage.getItem(bubbleStorageKey);
    if (savedBubble) {
      try {
        const parsed = JSON.parse(savedBubble);
        setBubblePosition(projectToNearestEdge(parsed));
      } catch (_) {
        setBubblePosition(getDefaultBubblePosition());
      }
    } else {
      const defaultPosition = getDefaultBubblePosition();
      setBubblePosition(defaultPosition);
      persistBubblePosition(defaultPosition);
    }

    const savedPanel = window.localStorage.getItem(panelStorageKey);
    if (savedPanel) {
      try {
        const parsed = JSON.parse(savedPanel);
        setPanelRect(clampPanelRect(parsed));
      } catch (_) {
        setPanelRect(getDefaultPanelRect());
      }
    } else {
      setPanelRect(getDefaultPanelRect());
    }
  }, [bubbleStorageKey, panelStorageKey]);

  useEffect(() => {
    loadNotes();
  }, [dbUserId]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const syncModalState = () => setIsModalOpen(hasOpenModal());
    syncModalState();

    const observer = new MutationObserver(syncModalState);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-modal"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        setBubblePosition((current) => {
          const next = projectToNearestEdge(current);
          persistBubblePosition(next);
          return next;
        });
        setPanelRect((current) => {
          const next = clampPanelRect(current);
          persistPanelRect(next);
          return next;
        });
      }, 150);
    };

    window.addEventListener("resize", onResize);
    return () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [bubbleStorageKey, panelStorageKey]);

  useEffect(() => {
    const onPointerMove = (event) => {
      const bubbleDrag = bubbleDragRef.current;
      if (bubbleDrag && bubbleDrag.pointerId === event.pointerId) {
        event.preventDefault();
        const dx = event.clientX - bubbleDrag.startX;
        const dy = event.clientY - bubbleDrag.startY;
        if (Math.abs(dx) > DRAG_START_THRESHOLD || Math.abs(dy) > DRAG_START_THRESHOLD) {
          pointerMovedRef.current = true;
        }
        const next = projectToNearestEdge({ x: bubbleDrag.initialX + dx, y: bubbleDrag.initialY + dy });
        setBubblePosition(next);
      }

      const panelDrag = panelDragRef.current;
      if (panelDrag && panelDrag.pointerId === event.pointerId) {
        event.preventDefault();
        const dx = event.clientX - panelDrag.startX;
        const dy = event.clientY - panelDrag.startY;
        setPanelRect(
          clampPanelRect({
            x: panelDrag.initialX + dx,
            y: panelDrag.initialY + dy,
            width: panelDrag.initialWidth,
            height: panelDrag.initialHeight,
          })
        );
      }

      const panelResize = panelResizeRef.current;
      if (panelResize && panelResize.pointerId === event.pointerId) {
        event.preventDefault();
        const dx = event.clientX - panelResize.startX;
        const dy = event.clientY - panelResize.startY;
        setPanelRect(
          clampPanelRect({
            x: panelResize.initialX,
            y: panelResize.initialY,
            width: panelResize.initialWidth + dx,
            height: panelResize.initialHeight + dy,
          })
        );
      }
    };

    const onPointerUp = (event) => {
      const bubbleDrag = bubbleDragRef.current;
      if (bubbleDrag && bubbleDrag.pointerId === event.pointerId) {
        bubbleDragRef.current = null;
        if (!pointerMovedRef.current) {
          if (isPanelVisible || isPanelMounted) closePanel();
          else openPanel();
        } else {
          setBubblePosition((current) => {
            const next = projectToNearestEdge(current);
            persistBubblePosition(next);
            return next;
          });
        }
      }

      const panelDrag = panelDragRef.current;
      if (panelDrag && panelDrag.pointerId === event.pointerId) {
        panelDragRef.current = null;
        persistPanelRect(panelRectRef.current);
      }

      const panelResize = panelResizeRef.current;
      if (panelResize && panelResize.pointerId === event.pointerId) {
        panelResizeRef.current = null;
        persistPanelRect(panelRectRef.current);
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (closePanelTimerRef.current) clearTimeout(closePanelTimerRef.current);
      for (const timer of saveTimersRef.current.values()) clearTimeout(timer);
    };
  }, [isPanelVisible, isPanelMounted]);

  const startBubbleDrag = (event) => {
    event.preventDefault();
    pointerMovedRef.current = false;
    bubbleDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: bubblePosition.x,
      initialY: bubblePosition.y,
    };
    if (typeof event.currentTarget?.setPointerCapture === "function") {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (_) {
        // noop
      }
    }
  };

  const startPanelDrag = (event) => {
    event.preventDefault();
    panelDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: panelRect.x,
      initialY: panelRect.y,
      initialWidth: panelRect.width,
      initialHeight: panelRect.height,
    };
    if (typeof event.currentTarget?.setPointerCapture === "function") {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (_) {
        // noop
      }
    }
  };

  const startResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    panelResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: panelRect.x,
      initialY: panelRect.y,
      initialWidth: panelRect.width,
      initialHeight: panelRect.height,
    };
    if (typeof event.currentTarget?.setPointerCapture === "function") {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (_) {
        // noop
      }
    }
  };

  const createTab = async () => {
    setError("");
    const result = await createFloatingNote({
      userId: Number(dbUserId),
      title: "New note",
      description: "",
      isGlobal: false,
    });

    if (!result.success) {
      setError(result.error?.message || "Failed to create note");
      return;
    }

    setNotes((prev) => [...prev, result.data]);
    setActiveNoteId(result.data.noteId);
    openPanel();
  };

  const deleteTab = async (noteId) => {
    const target = notesRef.current.find((note) => note.noteId === noteId);
    if (!target) return;
    const shouldDelete = await confirm({
      title: "Delete note tab",
      message: "Delete this note tab?",
      description: "This will permanently remove the note from the database.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!shouldDelete) return;

    if (Number(target.userId) !== Number(dbUserId)) {
      setError("You can only delete notes you created");
      return;
    }

    const result = await deleteFloatingNote(noteId);
    if (!result.success) {
      setError(result.error?.message || "Failed to delete note");
      return;
    }

    setNotes((prev) => {
      const remaining = prev.filter((note) => note.noteId !== noteId);
      setActiveNoteId((current) => {
        if (current !== noteId) return current;
        return remaining[0]?.noteId || null;
      });
      return remaining;
    });
  };

  const updateLocalNote = (noteId, updater) => {
    setNotes((prev) => prev.map((note) => (note.noteId === noteId ? updater(note) : note)));
  };

  const onChangeTitle = (value) => {
    if (!activeNote || activeNoteReadOnly) return;
    const nextTitle = value.slice(0, 200);
    updateLocalNote(activeNote.noteId, (note) => {
      const next = { ...note, title: nextTitle };
      scheduleSave(note.noteId, { title: next.title, description: next.description });
      return next;
    });
  };

  const onChangeDescription = (value) => {
    if (!activeNote || activeNoteReadOnly) return;
    updateLocalNote(activeNote.noteId, (note) => {
      const next = { ...note, description: value };
      scheduleSave(note.noteId, { title: next.title, description: next.description });
      return next;
    });
  };

  const onBlurSave = async (noteId) => {
    const note = notesRef.current.find((row) => row.noteId === noteId);
    if (!note || Number(note.userId) !== Number(dbUserId)) return;
    await flushSave(note.noteId, { title: note.title, description: note.description });
  };

  const onToggleGlobal = async (checked) => {
    if (!activeNote || !activeNoteOwnedByUser || !canManageGlobalNotes) return;

    updateLocalNote(activeNote.noteId, (note) => ({ ...note, isGlobal: checked }));
    setSaveStatus("saving");
    const result = await updateFloatingNote(activeNote.noteId, { isGlobal: checked });
    if (!result.success) {
      setSaveStatus("error");
      setError(result.error?.message || "Failed to update visibility");
      return;
    }

    updateLocalNote(activeNote.noteId, (note) => ({ ...note, ...result.data }));
    setSaveStatus("saved");
  };

  if (!Number.isInteger(Number(dbUserId)) || isModalOpen) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.bubble} ${isPanelVisible || isPanelMounted ? styles.bubbleOpen : ""}`}
        style={{ left: bubblePosition.x, top: bubblePosition.y }}
        onPointerDown={startBubbleDrag}
        aria-label="Open Notes"
      >
        <span className={styles.bubbleLabel}>N</span>
      </button>

      {isPanelMounted && (
        <section
          className={`${styles.panel} ${isPanelVisible ? styles.panelEnter : styles.panelExit}`}
          style={{
            left: panelRect.x,
            top: panelRect.y,
            width: panelRect.width,
            height: panelRect.height,
          }}
        >
          <header className={styles.header} onPointerDown={startPanelDrag}>
            <strong className={styles.heading}>Notes</strong>
            <div className={styles.headerRight} onPointerDown={(event) => event.stopPropagation()}>
              {canManageGlobalNotes && activeNote && (
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={Boolean(activeNote.isGlobal)}
                    disabled={!activeNoteOwnedByUser}
                    onChange={(event) => onToggleGlobal(event.target.checked)}
                  />
                  Show this note to all users
                </label>
              )}
              <button type="button" className={styles.headerButton} onClick={createTab}>
                + Tab
              </button>
              <button type="button" className={styles.headerButton} onClick={closePanel}>
                Close
              </button>
            </div>
          </header>

          <div className={styles.tabBar}>
            {notes.map((note) => {
              const editable = Number(note.userId) === Number(dbUserId);
              return (
                <button
                  key={note.noteId}
                  type="button"
                  className={`${styles.tab} ${note.noteId === activeNoteId ? styles.tabActive : ""}`}
                  onClick={() => setActiveNoteId(note.noteId)}
                  title={note.title || "Untitled"}
                >
                  <span className={styles.tabTitle}>{note.title || "Untitled"}</span>
                  {note.isGlobal && <span className={styles.tabBadge}>Global</span>}
                  {editable && (
                    <span
                      role="button"
                      tabIndex={0}
                      className={styles.tabClose}
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteTab(note.noteId);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          deleteTab(note.noteId);
                        }
                      }}
                      aria-label="Close tab"
                    >
                      ×
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className={styles.body}>
            {isLoading && <div className={styles.empty}>Loading your notes...</div>}

            {!isLoading && notes.length === 0 && (
              <div className={styles.emptyState}>
                <h4>No notes yet</h4>
                <p>Create your first note to track tasks, reminders, or test instructions.</p>
                <button type="button" className={styles.primaryAction} onClick={createTab}>
                  Create your first note
                </button>
              </div>
            )}

            {!isLoading && activeNote && (
              <>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="floating-note-title">
                    Title
                  </label>
                  <input
                    id="floating-note-title"
                    className={styles.input}
                    value={activeNote.title || ""}
                    onChange={(event) => onChangeTitle(event.target.value)}
                    onBlur={() => onBlurSave(activeNote.noteId)}
                    placeholder="Note title"
                    disabled={activeNoteReadOnly}
                  />
                </div>

                <div className={styles.fieldGrow}>
                  <label className={styles.label} htmlFor="floating-note-description">
                    Description
                  </label>
                  <textarea
                    id="floating-note-description"
                    className={styles.textarea}
                    value={activeNote.description || ""}
                    onChange={(event) => onChangeDescription(event.target.value)}
                    onBlur={() => onBlurSave(activeNote.noteId)}
                    placeholder="Type your note"
                    disabled={activeNoteReadOnly}
                  />
                </div>

                <div className={styles.meta}>
                  <span>
                    {saveStatus === "saving" && "Saving..."}
                    {saveStatus === "saved" && "Saved"}
                    {saveStatus === "error" && "Save failed"}
                    {saveStatus === "idle" && "Ready"}
                  </span>
                  {activeNoteReadOnly && <span className={styles.readOnly}>Read-only note</span>}
                  {!activeNoteReadOnly && activeNote.isGlobal && <span>Visible to all users</span>}
                </div>
              </>
            )}

            {error && <div className={styles.error}>{error}</div>}
          </div>

          <div className={styles.resizeHandle} onPointerDown={startResize} />
        </section>
      )}
    </div>
  );
}
