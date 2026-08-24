import { useEffect, useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import LayerSurface from "@/components/ui/LayerSurface";
import { MonthPicker } from "@/components/ui/monthPickerAPI";

const pad = (value) => String(value).padStart(2, "0");
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const toMonthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const getCapacityRange = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const dates = [];
  const cursor = new Date(firstDay);
  while (cursor <= lastDay) {
    if (cursor.getDay() !== 0) dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const formatDate = (dateKey) => new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const cellKey = (date, userId) => `${date}:${userId}`;
const formatHours = (value) => Number(value || 0).toFixed(Number(value) % 1 === 0 ? 0 : 2).replace(/0$/, "");

export default function CapacitySettingsPopup({
  isOpen,
  onClose,
  onSaved,
  compact = false,
  technicianUserId = null,
  initialDate = "",
}) {
  const [schedule, setSchedule] = useState([]);
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [drafts, setDrafts] = useState({});
  const [resets, setResets] = useState(new Set());
  const [fieldValues, setFieldValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => initialDate.slice(0, 7) || toMonthKey(new Date()));

  const range = useMemo(
    () => compact && initialDate ? [initialDate] : getCapacityRange(selectedMonth),
    [compact, initialDate, selectedMonth]
  );

  useEffect(() => {
    if (isOpen && initialDate) setSelectedMonth(initialDate.slice(0, 7));
  }, [initialDate, isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setSchedule([]);
    setSelectedDates(new Set());
    setDrafts({});
    setResets(new Set());
    setFieldValues({});
    setError("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setError("");
    setSchedule([]);
    setSelectedDates(new Set());
    setFieldValues({});
    fetch(`/api/technician-capacity?start=${range[0]}&end=${range[range.length - 1]}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to load capacity settings.");
        if (!active) return;
        setSchedule(payload.data || []);
        const preferredDate = initialDate && payload.data?.some((day) => day.date === initialDate)
          ? initialDate
          : payload.data?.[0]?.date;
        setSelectedDates(new Set(preferredDate ? [preferredDate] : []));
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message || "Unable to load capacity settings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [initialDate, isOpen, range]);

  const selectedDateList = useMemo(() => [...selectedDates].sort(), [selectedDates]);
  const selectionKey = selectedDateList.join("|");
  const technicians = (schedule[0]?.technicians || []).filter(
    (technician) => !compact || String(technician.userId) === String(technicianUserId)
  );
  const scheduleByDate = useMemo(() => new Map(schedule.map((day) => [day.date, day])), [schedule]);

  const getDisplayHours = (date, technician) => {
    const key = cellKey(date, technician.userId);
    const dayTech = scheduleByDate.get(date)?.technicians.find((entry) => entry.userId === technician.userId);
    if (Object.prototype.hasOwnProperty.call(drafts, key)) return Number(drafts[key]);
    if (resets.has(key)) return Number(dayTech?.suggestedHours || 0);
    return Number(dayTech?.effectiveHours || 0);
  };

  const toggleDate = (date) => {
    setSelectedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) {
        if (next.size > 1) next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const setTechnicianHours = (userId, value) => {
    setFieldValues((current) => ({ ...current, [userId]: value }));
    if (value === "") return;
    const hours = Math.min(24, Math.max(0, Number(value)));
    if (!Number.isFinite(hours)) return;
    setDrafts((current) => {
      const next = { ...current };
      selectedDateList.forEach((date) => { next[cellKey(date, userId)] = hours; });
      return next;
    });
    setResets((current) => {
      const next = new Set(current);
      selectedDateList.forEach((date) => next.delete(cellKey(date, userId)));
      return next;
    });
  };

  const resetTechnician = (userId) => {
    setFieldValues((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
    setDrafts((current) => {
      const next = { ...current };
      selectedDateList.forEach((date) => { delete next[cellKey(date, userId)]; });
      return next;
    });
    setResets((current) => {
      const next = new Set(current);
      selectedDateList.forEach((date) => next.add(cellKey(date, userId)));
      return next;
    });
  };

  const resetAllSelected = () => {
    technicians.forEach((technician) => resetTechnician(technician.userId));
  };

  const getCommonHours = (technician) => {
    if (Object.prototype.hasOwnProperty.call(fieldValues, technician.userId)) {
      return fieldValues[technician.userId];
    }
    if (!selectedDateList.length) return "";
    const values = selectedDateList.map((date) => getDisplayHours(date, technician));
    return values.every((value) => value === values[0]) ? values[0] : "";
  };

  useEffect(() => {
    setFieldValues({});
  }, [selectionKey]);

  const getDayTotal = (day) => day.technicians.reduce(
    (total, technician) => total + getDisplayHours(day.date, technician),
    0
  );

  const saveChanges = async () => {
    const changes = Object.entries(drafts).map(([key, availableHours]) => {
      const separator = key.lastIndexOf(":");
      return { date: key.slice(0, separator), userId: Number(key.slice(separator + 1)), availableHours };
    });
    const resetRows = [...resets]
      .filter((key) => !Object.prototype.hasOwnProperty.call(drafts, key))
      .map((key) => {
        const separator = key.lastIndexOf(":");
        return { date: key.slice(0, separator), userId: Number(key.slice(separator + 1)) };
      });

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/technician-capacity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes, resets: resetRows }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to save capacity settings.");
      onSaved?.();
      onClose?.();
    } catch (saveError) {
      setError(saveError.message || "Unable to save capacity settings.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <PopupModal
      isOpen
      onClose={saving ? undefined : onClose}
      ariaLabel="Technician capacity settings"
      cardClassName={`app-settings-popup-card capacity-settings-popup-card${compact ? " capacity-settings-popup-card--compact" : ""}`}
      cardStyle={{
        width: compact ? "min(520px, 100%)" : "min(1180px, 100%)",
        height: compact ? "auto" : undefined,
        minHeight: compact ? 0 : undefined,
        padding: "var(--page-card-padding)",
        overflowX: "hidden",
        overflowY: compact ? "auto" : "hidden",
        boxSizing: "border-box",
      }}
    >
      <div
        className={`app-settings-popup capacity-settings${compact ? " capacity-settings--compact" : ""}`}
        style={compact ? { width: "100%", height: "auto", minHeight: 0, overflow: "visible" } : undefined}
      >
        <header className="app-popup-compact-header capacity-settings__header">
          <h2>Technician capacity settings</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="button" variant="primary" size="sm" busy={saving} onClick={saveChanges} disabled={loading || (!Object.keys(drafts).length && !resets.size)}>Save capacity</Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>Close</Button>
          </div>
        </header>

        {error ? <div className="capacity-settings__message capacity-settings__message--error" role="alert">{error}</div> : null}

        {loading ? (
          <div className="capacity-settings__message">Loading technician capacity…</div>
        ) : (
          compact ? (
            <LayerTheme padding="12px" gap="10px" className="capacity-settings__compact-editor" style={{ width: "100%", minWidth: 0, boxSizing: "border-box", overflow: "visible" }}>
              <div className="capacity-settings__section-heading">
                <div>
                  <strong>Available hours</strong>
                  <span>{selectedDateList[0] ? formatDate(selectedDateList[0]) : "Current day"}</span>
                </div>
              </div>
              <div className="capacity-settings__tech-list capacity-settings__tech-list--compact">
                {technicians.map((technician) => {
                  const commonHours = getCommonHours(technician);
                  const selectedCells = selectedDateList.map((date) => scheduleByDate.get(date)?.technicians.find((entry) => entry.userId === technician.userId)).filter(Boolean);
                  const leaveCells = selectedCells.filter((entry) => entry.leaveHours > 0);
                  const hasManual = selectedDateList.some((date) => {
                    const key = cellKey(date, technician.userId);
                    const entry = scheduleByDate.get(date)?.technicians.find((item) => item.userId === technician.userId);
                    return Object.prototype.hasOwnProperty.call(drafts, key) || (!resets.has(key) && entry?.hasOverride);
                  });
                  return (
                    <LayerSurface key={technician.userId} padding="12px" gap="8px" className="capacity-settings__tech-row capacity-settings__tech-row--compact">
                      <div className="capacity-settings__tech-person">
                        <strong>{technician.name}</strong>
                        <span>{formatHours(technician.weeklyHours)}h/week · {formatHours(technician.dailyHours)}h standard day</span>
                        {leaveCells.length ? <small>Capacity reduced by approved leave</small> : null}
                      </div>
                      <label className="capacity-settings__hours-field">
                        <span>Available hours</span>
                        <input
                          className="app-input"
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          value={commonHours}
                          onChange={(event) => setTechnicianHours(technician.userId, event.target.value)}
                        />
                      </label>
                      <div className="capacity-settings__row-action">
                        <span>{hasManual ? "Manual" : leaveCells.length ? "Leave adjusted" : "HR default"}</span>
                        <Button type="button" variant="secondary" size="xs" onClick={() => resetTechnician(technician.userId)}>Reset</Button>
                      </div>
                    </LayerSurface>
                  );
                })}
                {!technicians.length ? <div className="capacity-settings__message">This technician is not available in today&apos;s capacity schedule.</div> : null}
              </div>
            </LayerTheme>
          ) : (
          <div className="capacity-settings__layout">
            <LayerTheme padding="12px" gap="10px" className="capacity-settings__dates">
              <div className="capacity-settings__section-heading">
                <div><strong>Select dates</strong><span>{selectedDateList.length} selected</span></div>
                <Button type="button" variant="secondary" size="xs" onClick={() => setSelectedDates(new Set(schedule.map((day) => day.date)))}>Select all</Button>
              </div>
              <MonthPicker
                aria-label="Capacity month"
                value={selectedMonth}
                onValueChange={setSelectedMonth}
                disabled={loading || saving}
                minYear={new Date().getFullYear() - 10}
                maxYear={new Date().getFullYear() + 10}
              />
              <div className="capacity-settings__date-list">
                {schedule.map((day) => (
                  <label key={day.date} className="capacity-settings__date-option">
                    <input type="checkbox" checked={selectedDates.has(day.date)} onChange={() => toggleDate(day.date)} />
                    <span><strong>{formatDate(day.date)}</strong><small>{formatHours(getDayTotal(day))}h capacity</small></span>
                  </label>
                ))}
              </div>
            </LayerTheme>

            <LayerTheme padding="12px" gap="10px" className="capacity-settings__editor">
              <div className="capacity-settings__section-heading">
                <div>
                  <strong>Available hours by technician</strong>
                  <span>{selectedDateList.length === 1 ? formatDate(selectedDateList[0]) : `${selectedDateList.length} days use each entered value`}</span>
                </div>
                <Button type="button" variant="secondary" size="xs" onClick={resetAllSelected}>Use HR defaults</Button>
              </div>

              <div className="capacity-settings__tech-list">
                {technicians.map((technician) => {
                  const commonHours = getCommonHours(technician);
                  const selectedCells = selectedDateList.map((date) => scheduleByDate.get(date)?.technicians.find((entry) => entry.userId === technician.userId)).filter(Boolean);
                  const leaveCells = selectedCells.filter((entry) => entry.leaveHours > 0);
                  const hasManual = selectedDateList.some((date) => {
                    const key = cellKey(date, technician.userId);
                    const entry = scheduleByDate.get(date)?.technicians.find((item) => item.userId === technician.userId);
                    return Object.prototype.hasOwnProperty.call(drafts, key) || (!resets.has(key) && entry?.hasOverride);
                  });
                  return (
                    <LayerSurface key={technician.userId} padding="12px" gap="8px" className="capacity-settings__tech-row">
                      <div className="capacity-settings__tech-person">
                        <strong>{technician.name}</strong>
                        <span>{formatHours(technician.weeklyHours)}h/week · {formatHours(technician.dailyHours)}h standard day</span>
                        {leaveCells.length ? <small>{leaveCells.length} selected {leaveCells.length === 1 ? "day" : "days"} reduced by approved leave</small> : null}
                      </div>
                      <label className="capacity-settings__hours-field">
                        <span>Available hours</span>
                        <input
                          className="app-input"
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          value={commonHours}
                          placeholder={commonHours === "" ? "Mixed" : undefined}
                          onChange={(event) => setTechnicianHours(technician.userId, event.target.value)}
                        />
                      </label>
                      <div className="capacity-settings__row-action">
                        <span>{hasManual ? "Manual" : leaveCells.length ? "Leave adjusted" : "HR default"}</span>
                        <Button type="button" variant="secondary" size="xs" onClick={() => resetTechnician(technician.userId)}>Reset</Button>
                      </div>
                    </LayerSurface>
                  );
                })}
              </div>
            </LayerTheme>
          </div>
          )
        )}

      </div>

      <style jsx>{`
        .capacity-settings { display: flex; flex-direction: column; gap: var(--layout-card-gap); height: 100%; min-height: 0; color: var(--text-1); }
        .capacity-settings__header, .capacity-settings__section-heading, .capacity-settings__row-action { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .capacity-settings__header h2 { margin: 0; color: var(--text-accent); font-size: clamp(1.25rem, 3vw, 1.65rem); }
        .capacity-settings__layout { display: grid; grid-template-columns: minmax(230px, 0.68fr) minmax(0, 2fr); gap: var(--layout-card-gap); flex: 1; min-height: 0; overflow: hidden; }
        .capacity-settings__dates, .capacity-settings__editor { height: 100%; min-height: 0; }
        .capacity-settings__dates { overflow: visible; }
        .capacity-settings__editor { overflow: hidden; }
        .capacity-settings__section-heading > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .capacity-settings__section-heading span { color: var(--text-1); font-size: 0.78rem; }
        .capacity-settings__date-list { flex: 1 1 0; min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-gutter: stable; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; gap: 6px; padding-right: 4px; }
        .capacity-settings__tech-list { flex: 1 1 0; min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-gutter: stable; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); align-content: start; gap: 8px; padding-right: 4px; }
        .capacity-settings__date-option { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--surface); cursor: pointer; }
        .capacity-settings__date-option input { width: 18px; height: 18px; accent-color: var(--primary); flex: 0 0 auto; }
        .capacity-settings__date-option span { display: flex; flex-direction: column; gap: 2px; }
        .capacity-settings__date-option small, .capacity-settings__tech-person span, .capacity-settings__tech-person small { color: var(--text-1); font-size: 0.75rem; }
        .capacity-settings__tech-row { display: grid !important; grid-template-columns: minmax(0, 1fr) 116px; align-items: center; align-self: start; }
        .capacity-settings__tech-person { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .capacity-settings__tech-person small { color: var(--warning); }
        .capacity-settings__hours-field { display: flex; flex-direction: column; gap: 4px; font-size: 0.72rem; font-weight: 600; }
        .capacity-settings__hours-field input { width: 100%; min-height: 44px; }
        .capacity-settings__row-action { grid-column: 1 / -1; }
        .capacity-settings__row-action > span { color: var(--text-1); font-size: 0.72rem; white-space: nowrap; }
        .capacity-settings__message { padding: 12px; border-radius: var(--radius-sm); background: var(--theme); }
        .capacity-settings__message--error { background: var(--danger-surface); color: var(--danger); }
        :global(.capacity-settings-popup-card) { overflow: hidden !important; }
        :global(.capacity-settings-popup-card--compact) { height: auto !important; min-height: 0 !important; max-height: calc(100dvh - (var(--popup-viewport-gap, clamp(10px, 2.5vw, 20px)) * 2)) !important; overflow-x: hidden !important; overflow-y: auto !important; }
        .capacity-settings--compact { height: auto !important; min-height: 0; overflow: visible; }
        .capacity-settings__compact-editor { width: 100%; min-width: 0; min-height: 0; overflow: visible; box-sizing: border-box; }
        .capacity-settings__tech-list--compact { flex: none; width: 100%; min-width: 0; min-height: auto; overflow: visible; padding-right: 0; grid-template-columns: minmax(0, 1fr); box-sizing: border-box; }
        .capacity-settings__tech-row--compact { width: 100%; min-width: 0; grid-template-columns: minmax(0, 1fr); box-sizing: border-box; }
        .capacity-settings__tech-row--compact .capacity-settings__hours-field { grid-column: 1; width: 100%; min-width: 0; }
        .capacity-settings--compact .capacity-settings__header { width: 100%; min-width: 0; flex-wrap: wrap; }
        .capacity-settings--compact .app-popup-compact-header__actions { width: 100%; justify-content: flex-end; }
        @media (max-width: 767px) {
          :global(.capacity-settings-popup-card) { overflow-y: auto !important; }
          .capacity-settings { height: auto; min-height: 100%; }
          .capacity-settings__header { align-items: center; }
          .capacity-settings__layout { flex: none; grid-template-columns: 1fr; grid-template-rows: auto; overflow: visible; }
          .capacity-settings__dates { height: clamp(300px, 48dvh, 440px); min-height: 300px; overflow: visible; }
          .capacity-settings__editor { height: auto; overflow: visible; }
          .capacity-settings__date-list { overflow-y: auto; }
          .capacity-settings__tech-list { overflow-y: visible; }
          .capacity-settings__tech-list { grid-template-columns: 1fr; }
        }
      `}</style>
    </PopupModal>
  );
}
