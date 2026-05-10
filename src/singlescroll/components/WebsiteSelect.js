// file location: src/singlescroll/components/WebsiteSelect.js
// Custom <select> replacement for /website pages so the dropdown panel
// itself reads as the same dark glass as the rest of the portal. The
// native control's option list is rendered by the OS and can't be
// styled — this component renders a button + a positioned popover
// menu that uses our own CSS module so the look is fully consistent.
//
// Public API is intentionally compatible with the bits of <select> we
// use elsewhere:
//   value     — currently-selected option value
//   onChange  — (value) => void
//   options   — [{ value, label, hint? }]
//   placeholder — shown when no value is set
//   className — passed through to the trigger button

import { useEffect, useId, useRef, useState } from "react";
import styles from "../styles/singlescroll.module.css";

export default function WebsiteSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  disabled = false,
  className = "",
  id,
  required,
  name,
}) {
  const fallbackId = useId();
  const triggerId = id || `ws-${fallbackId}`;
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      if (!rootRef.current || rootRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(options.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        if (activeIdx >= 0 && options[activeIdx]) {
          e.preventDefault();
          onChange(options[activeIdx].value);
          setOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, options, activeIdx, onChange]);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => String(o.value) === String(value));
    setActiveIdx(idx >= 0 ? idx : 0);
  }, [open, options, value]);

  return (
    <div
      ref={rootRef}
      className={styles.wsRoot}
      data-open={open ? "true" : "false"}
    >
      <button
        type="button"
        id={triggerId}
        className={`app-btn ${styles.wsTrigger} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? styles.wsTriggerValue : styles.wsTriggerPlaceholder}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={styles.wsCaret} aria-hidden="true" />
      </button>
      {required ? (
        // Hidden native field so the surrounding <form> still validates
        // "required" without us re-implementing constraint validation.
        <input
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value ?? ""}
          onChange={() => {}}
          name={name}
          style={{
            position: "absolute",
            opacity: 0,
            width: 0,
            height: 0,
            pointerEvents: "none",
          }}
        />
      ) : null}
      {open ? (
        <ul
          ref={listRef}
          role="listbox"
          aria-labelledby={triggerId}
          className={styles.wsMenu}
        >
          {options.length === 0 ? (
            <li className={styles.wsEmpty}>No options</li>
          ) : (
            options.map((opt, idx) => {
              const isSel = String(opt.value) === String(value);
              const isActive = idx === activeIdx;
              return (
                <li
                  key={`${opt.value}-${idx}`}
                  role="option"
                  aria-selected={isSel}
                  className={`${styles.wsOption} ${
                    isSel ? styles.wsOptionSelected : ""
                  } ${isActive ? styles.wsOptionActive : ""}`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span className={styles.wsOptionLabel}>{opt.label}</span>
                  {opt.hint ? (
                    <span className={styles.wsOptionHint}>{opt.hint}</span>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
