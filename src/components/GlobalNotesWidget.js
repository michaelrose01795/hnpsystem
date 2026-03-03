import React, { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/context/UserContext";
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
const NOTE_SLASH_COMMANDS = [
  { command: "/job[number]", autocomplete: "/job", pattern: "job" },
  { command: "/[number]", autocomplete: "/", pattern: "" },
  { command: "/cust[name]", autocomplete: "/cust", pattern: "cust" },
  { command: "/customer", autocomplete: "/customer", pattern: "customer" },
  { command: "/addcust[name or email]", autocomplete: "/addcust[]", pattern: "addcust" },
  { command: "/vehicle", autocomplete: "/vehicle", pattern: "vehicle" },
  { command: "/vhc[jobnumber]", autocomplete: "/vhc", pattern: "vhc" },
  { command: "/part[partnumber]", autocomplete: "/part", pattern: "part" },
  { command: "/parts", autocomplete: "/parts", pattern: "parts" },
  { command: "/order[ordernumber]", autocomplete: "/order", pattern: "order" },
  { command: "/invoice[number]", autocomplete: "/invoice", pattern: "invoice" },
  { command: "/account[id]", autocomplete: "/account", pattern: "account" },
  { command: "/tracking", autocomplete: "/tracking", pattern: "tracking" },
  { command: "/valet", autocomplete: "/valet", pattern: "valet" },
  { command: "/hr", autocomplete: "/hr", pattern: "hr" },
  { command: "/user[name]", autocomplete: "/user", pattern: "user" },
  { command: "/clocking", autocomplete: "/clocking", pattern: "clocking" },
  { command: "/archive", autocomplete: "/archive", pattern: "archive" },
  { command: "/myjobs", autocomplete: "/myjobs", pattern: "myjobs" },
  { command: "/appointments", autocomplete: "/appointments", pattern: "appointments" },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const isLikelyHtml = (value) => /<\/?[a-z][\s\S]*>/i.test(String(value || ""));

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
  const [commandSuggestions, setCommandSuggestions] = useState([]);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [commandMenuPosition, setCommandMenuPosition] = useState({ top: 0, left: 0 });

  const notesRef = useRef([]);
  const panelRectRef = useRef(panelRect);
  const descriptionInputRef = useRef(null);
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
  const panelOpenStorageKey = `hnp-floating-notes-panel-open-${storageSuffix}`;
  const activeNoteStorageKey = `hnp-floating-notes-active-${storageSuffix}`;

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


  useEffect(() => {
    const editor = descriptionInputRef.current;
    if (!editor || !isPanelMounted) return;
    const description = activeNote?.description || "";
    const nextHtml = isLikelyHtml(description)
      ? description
      : escapeHtml(description).replace(/\n/g, "<br>");
    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
  }, [activeNoteId, activeNote?.description, isPanelMounted, isPanelVisible]);

  useEffect(() => {
    setCommandSuggestions([]);
    setSelectedCommandIndex(0);
  }, [activeNoteId, isPanelVisible]);

  useEffect(() => {
    persistActiveNoteId(activeNoteId);
  }, [activeNoteId]);

  const persistBubblePosition = (position) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(bubbleStorageKey, JSON.stringify(position));
  };

  const persistPanelRect = (rect) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(panelStorageKey, JSON.stringify(rect));
  };

  const persistPanelOpen = (isOpen) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(panelOpenStorageKey, isOpen ? "1" : "0");
  };

  const persistActiveNoteId = (noteId) => {
    if (typeof window === "undefined") return;
    if (!noteId) {
      window.localStorage.removeItem(activeNoteStorageKey);
      return;
    }
    window.localStorage.setItem(activeNoteStorageKey, String(noteId));
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
      const storedActiveNoteId =
        typeof window !== "undefined" ? Number(window.localStorage.getItem(activeNoteStorageKey)) : null;
      setNotes(rows);
      setActiveNoteId((current) => {
        if (rows.length === 0) return null;
        if (Number.isInteger(storedActiveNoteId) && rows.some((row) => row.noteId === storedActiveNoteId)) {
          return storedActiveNoteId;
        }
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
    persistPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelVisible(false);
    persistPanelOpen(false);
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

    if (window.localStorage.getItem(panelOpenStorageKey) === "1") {
      setIsPanelMounted(true);
      requestAnimationFrame(() => setIsPanelVisible(true));
    }
  }, [bubbleStorageKey, panelStorageKey, panelOpenStorageKey]);

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
      title: "",
      description: "",
      isGlobal: false,
    });

    if (!result.success) {
      setError(result.error?.message || "Failed to create note");
      return;
    }

    setNotes((prev) => [...prev, result.data]);
    setActiveNoteId(result.data.noteId);
    persistActiveNoteId(result.data.noteId);
    openPanel();
  };

  const deleteTab = async (noteId) => {
    const target = notesRef.current.find((note) => note.noteId === noteId);
    if (!target) return;

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
        const next = remaining[0]?.noteId || null;
        persistActiveNoteId(next);
        return next;
      });
      return remaining;
    });
  };

  const updateLocalNote = (noteId, updater) => {
    setNotes((prev) => prev.map((note) => (note.noteId === noteId ? updater(note) : note)));
  };

  const detectSlashSuggestions = (textBeforeCursor) => {
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/");
    if (lastSlashIndex === -1) return [];

    const snippet = textBeforeCursor.slice(lastSlashIndex + 1);
    if (snippet.includes(" ") || snippet.includes("\n")) return [];

    const searchTerm = snippet.toLowerCase();
    return NOTE_SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.pattern.startsWith(searchTerm) ||
        (searchTerm === "" && cmd.pattern === "")
    ).slice(0, 8);
  };

  const getCaretRect = (editor) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.endContainer)) return null;
    const collapsed = range.cloneRange();
    collapsed.collapse(true);
    const rect = collapsed.getClientRects()[0];
    if (rect) return rect;

    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    collapsed.insertNode(marker);
    const markerRect = marker.getBoundingClientRect();
    marker.parentNode?.removeChild(marker);
    return markerRect;
  };

  const updateCommandMenuPosition = () => {
    const editor = descriptionInputRef.current;
    if (!editor) return;
    const fieldContainer = editor.parentElement;
    const editorOffsetTop = editor.offsetTop || 0;
    const editorOffsetLeft = editor.offsetLeft || 0;
    const caretRect = getCaretRect(editor);
    const editorRect = editor.getBoundingClientRect();
    if (!caretRect) {
      setCommandMenuPosition({ top: editorOffsetTop + 52, left: editorOffsetLeft + 10 });
      return;
    }

    const containerWidth = fieldContainer?.clientWidth || editorRect.width;
    const lineOffset = 40; // roughly two rows under caret
    const relativeTop = caretRect.top - editorRect.top;
    const relativeLeft = caretRect.left - editorRect.left;
    const nextTop = Math.max(12, editorOffsetTop + relativeTop + lineOffset);
    const nextLeft = Math.max(
      editorOffsetLeft + 10,
      Math.min(editorOffsetLeft + relativeLeft, containerWidth - 200)
    );
    setCommandMenuPosition({ top: nextTop, left: nextLeft });
  };

  const getTextBeforeCaret = (editor) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return "";
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.endContainer)) return "";
    const preRange = range.cloneRange();
    preRange.selectNodeContents(editor);
    preRange.setEnd(range.endContainer, range.endOffset);
    return preRange.toString();
  };

  const syncFromEditor = () => {
    const editor = descriptionInputRef.current;
    if (!editor || !activeNote || activeNoteReadOnly) return;
    const nextValue = editor.innerHTML === "<br>" ? "" : editor.innerHTML;
    onChangeDescription(nextValue);
    const textBeforeCaret = getTextBeforeCaret(editor);
    const suggestions = detectSlashSuggestions(textBeforeCaret);
    setCommandSuggestions(suggestions);
    setSelectedCommandIndex(0);
    if (suggestions.length > 0) {
      updateCommandMenuPosition();
    }
  };

  const applySlashCommand = (command) => {
    const editor = descriptionInputRef.current;
    if (!editor || !activeNote || activeNoteReadOnly) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    if (range.endContainer.nodeType === 3) {
      const node = range.endContainer;
      const original = node.textContent || "";
      const caretOffset = range.endOffset;
      const slashOffset = original.lastIndexOf("/", caretOffset - 1);
      if (slashOffset >= 0) {
        const nextText =
          `${original.slice(0, slashOffset)}${command.autocomplete} ${original.slice(caretOffset)}`;
        node.textContent = nextText;
        const nextOffset = slashOffset + command.autocomplete.length + 1;
        const nextRange = document.createRange();
        nextRange.setStart(node, Math.min(nextOffset, nextText.length));
        nextRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(nextRange);
      } else {
        document.execCommand("insertText", false, `${command.autocomplete} `);
      }
    } else {
      document.execCommand("insertText", false, `${command.autocomplete} `);
    }

    syncFromEditor();
    setCommandSuggestions([]);
    setSelectedCommandIndex(0);
  };

  const handleDescriptionKeyDown = (event) => {
    if (!activeNote || activeNoteReadOnly) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      document.execCommand("bold", false);
      syncFromEditor();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "i") {
      event.preventDefault();
      document.execCommand("italic", false);
      syncFromEditor();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "u") {
      event.preventDefault();
      document.execCommand("underline", false);
      syncFromEditor();
      return;
    }

    if (commandSuggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedCommandIndex((prev) => (prev + 1) % commandSuggestions.length);
        updateCommandMenuPosition();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedCommandIndex((prev) => (prev - 1 + commandSuggestions.length) % commandSuggestions.length);
        updateCommandMenuPosition();
        return;
      }
      if (event.key === "Tab" || event.key === "Enter") {
        event.preventDefault();
        applySlashCommand(commandSuggestions[selectedCommandIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setCommandSuggestions([]);
        return;
      }
    }

    if (event.key === " " || event.code === "Space") {
      const editor = descriptionInputRef.current;
      if (!editor) return;
      const line = (getTextBeforeCaret(editor).split("\n").pop() || "").trim();
      if (line === "-") {
        event.preventDefault();
        document.execCommand("insertUnorderedList", false);
        requestAnimationFrame(() => {
          const selection = window.getSelection();
          const anchorNode = selection?.anchorNode;
          const liElement = anchorNode && anchorNode.nodeType === 3
            ? anchorNode.parentElement?.closest("li")
            : anchorNode?.closest?.("li");
          if (liElement && liElement.textContent?.trim() === "-") {
            liElement.textContent = "";
          }
          syncFromEditor();
        });
      }
    }
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

  const handleDescriptionInput = () => syncFromEditor();

  const handleDescriptionPaste = (event) => {
    if (!activeNote || activeNoteReadOnly) return;
    event.preventDefault();
    const plainText = event.clipboardData?.getData("text/plain") || "";
    if (!plainText) return;
    document.execCommand("insertText", false, plainText);
    syncFromEditor();
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
            <div className={styles.headerRow}>
              <div className={styles.tabBarScroller} onPointerDown={(event) => event.stopPropagation()}>
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
              </div>
              <div className={styles.headerRight} onPointerDown={(event) => event.stopPropagation()}>
                <button type="button" className={styles.headerButton} onClick={createTab}>
                  + Tab
                </button>
                <button type="button" className={styles.headerButton} onClick={closePanel} aria-label="Close notes panel">
                  X
                </button>
              </div>
            </div>
          </header>

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
                  <label className={`${styles.label} ${styles.titleLabel}`} htmlFor="floating-note-title">
                    Title
                  </label>
                <input
                  id="floating-note-title"
                  className={`${styles.input} ${styles.titleInput}`}
                  value={activeNote.title || ""}
                  onChange={(event) => onChangeTitle(event.target.value)}
                  onBlur={() => onBlurSave(activeNote.noteId)}
                  placeholder="Title"
                  disabled={activeNoteReadOnly}
                />
                </div>

                <div className={styles.fieldGrow}>
                  <label className={`${styles.label} ${styles.descriptionLabel}`} htmlFor="floating-note-description">
                    Description
                  </label>
                  <div
                    id="floating-note-description"
                    ref={descriptionInputRef}
                    className={`${styles.richEditor} ${activeNoteReadOnly ? styles.richEditorReadOnly : ""}`}
                    contentEditable={!activeNoteReadOnly}
                    suppressContentEditableWarning
                    onInput={handleDescriptionInput}
                    onPaste={handleDescriptionPaste}
                    onKeyDown={handleDescriptionKeyDown}
                    onBlur={() => {
                      setCommandSuggestions([]);
                      onBlurSave(activeNote.noteId);
                    }}
                    data-placeholder="Type your notes... Keyboard: Ctrl+B, Ctrl+I, Ctrl+U, '-' bullets, '/' commands"
                    role="textbox"
                    aria-multiline="true"
                  />
                  {commandSuggestions.length > 0 && (
                    <div
                      className={styles.commandSuggestions}
                      style={{ top: `${commandMenuPosition.top}px`, left: `${commandMenuPosition.left}px` }}
                    >
                      {commandSuggestions.map((cmd, index) => (
                        <div
                          key={`${cmd.command}-${index}`}
                          className={`${styles.commandSuggestionItem} ${
                            index === selectedCommandIndex ? styles.commandSuggestionItemActive : ""
                          }`}
                          role="button"
                          tabIndex={0}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applySlashCommand(cmd)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              applySlashCommand(cmd);
                            }
                          }}
                        >
                          <span className={styles.commandSuggestionCmd}>{cmd.command}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {canManageGlobalNotes && activeNoteOwnedByUser && (
                  <div className={styles.visibilityPanel}>
                    <p className={styles.visibilityTitle}>Visibility</p>
                    <label className={styles.visibilityOption}>
                      <input
                        type="radio"
                        name={`note-visibility-${activeNote.noteId}`}
                        checked={!activeNote.isGlobal}
                        onChange={() => onToggleGlobal(false)}
                      />
                      Independent note (only me)
                    </label>
                    <label className={styles.visibilityOption}>
                      <input
                        type="radio"
                        name={`note-visibility-${activeNote.noteId}`}
                        checked={Boolean(activeNote.isGlobal)}
                        onChange={() => onToggleGlobal(true)}
                      />
                      Show this note to all users (dev)
                    </label>
                  </div>
                )}

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
