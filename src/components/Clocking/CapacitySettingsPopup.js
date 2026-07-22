import { useEffect, useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import LayerSurface from "@/components/ui/LayerSurface";

const pad = (value) => String(value).padStart(2, "0");
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const getCapacityRange = () => {
  const dates = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (dates.length < 28) {
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

export default function CapacitySettingsPopup({ isOpen, onClose, onSaved }) {
  const [schedule, setSchedule] = useState([]);
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [drafts, setDrafts] = useState({});
  const [resets, setResets] = useState(new Set());
  const [fieldValues, setFieldValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const range = useMemo(getCapacityRange, []);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setError("");
    setDrafts({});
    setResets(new Set());
    setFieldValues({});
    fetch(`/api/technician-capacity?start=${range[0]}&end=${range[range.length - 1]}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to load capacity settings.");
        if (!active) return;
        setSchedule(payload.data || []);
        setSelectedDates(new Set(payload.data?.[0]?.date ? [payload.data[0].date] : []));
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message || "Unable to load capacity settings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [isOpen, range]);

  const selectedDateList = useMemo(() => [...selectedDates].sort(), [selectedDates]);
  const selectionKey = selectedDateList.join("|");
  const technicians = schedule[0]?.technicians || [];
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
      cardStyle={{
        width: "min(1180px, 100%)",
        height: "min(760px, calc(100dvh - (var(--popup-viewport-gap, 20px) * 2)))",
        maxHeight: "min(760px, calc(100dvh - (var(--popup-viewport-gap, 20px) * 2)))",
        padding: "var(--page-card-padding)",
        overflow: "hidden",
      }}
    >
      <div className="capacity-settings">
        <header className="app-popup-compact-header capacity-settings__header">
          <h2>Technician capacity settings</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>Close</Button>
        </header>

        {error ? <div className="capacity-settings__message capacity-settings__message--error" role="alert">{error}</div> : null}

        {loading ? (
          <div className="capacity-settings__message">Loading technician capacity…</div>
        ) : (
          <div className="capacity-settings__layout">
            <LayerTheme padding="12px" gap="10px" className="capacity-settings__dates">
              <div className="capacity-settings__section-heading">
                <div><strong>Select dates</strong><span>{selectedDateList.length} selected</span></div>
                <Button type="button" variant="ghost" size="xs" onClick={() => setSelectedDates(new Set(schedule.map((day) => day.date)))}>Select all</Button>
              </div>
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
                <Button type="button" variant="ghost" size="xs" onClick={resetAllSelected}>Use HR defaults</Button>
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
                        <Button type="button" variant="ghost" size="xs" onClick={() => resetTechnician(technician.userId)}>Reset</Button>
                      </div>
                    </LayerSurface>
                  );
                })}
              </div>
            </LayerTheme>
          </div>
        )}

        <footer className="capacity-settings__footer">
          <span>{Object.keys(drafts).length + resets.size} pending cell changes</span>
          <div>
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="button" variant="primary" busy={saving} onClick={saveChanges} disabled={loading || (!Object.keys(drafts).length && !resets.size)}>Save capacity</Button>
          </div>
        </footer>
      </div>

      <style jsx>{`
        .capacity-settings { display: flex; flex-direction: column; gap: var(--layout-card-gap); height: 100%; min-height: 0; color: var(--text-1); }
        .capacity-settings__header, .capacity-settings__section-heading, .capacity-settings__footer, .capacity-settings__row-action { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .capacity-settings__header h2 { margin: 0; color: var(--text-accent); font-size: clamp(1.25rem, 3vw, 1.65rem); }
        .capacity-settings__layout { display: grid; grid-template-columns: minmax(230px, 0.68fr) minmax(0, 2fr); gap: var(--layout-card-gap); flex: 1; min-height: 0; overflow: hidden; }
        .capacity-settings__dates, .capacity-settings__editor { height: 100%; min-height: 0; overflow: hidden; }
        .capacity-settings__section-heading > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .capacity-settings__section-heading span, .capacity-settings__footer > span { color: var(--text-1); font-size: 0.78rem; }
        .capacity-settings__date-list { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px; }
        .capacity-settings__tech-list { min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); align-content: start; gap: 8px; padding-right: 4px; }
        .capacity-settings__date-option { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--surface); cursor: pointer; }
        .capacity-settings__date-option input { width: 18px; height: 18px; accent-color: var(--accentMain); flex: 0 0 auto; }
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
        .capacity-settings__footer > div { display: flex; gap: 8px; }
        @media (max-width: 767px) {
          .capacity-settings__header { align-items: center; }
          .capacity-settings__layout { grid-template-columns: 1fr; grid-template-rows: minmax(150px, 0.72fr) minmax(250px, 1.6fr); }
          .capacity-settings__tech-list { grid-template-columns: 1fr; }
          .capacity-settings__footer { align-items: stretch; flex-direction: column; }
          .capacity-settings__footer > div { display: grid; grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </PopupModal>
  );
}
