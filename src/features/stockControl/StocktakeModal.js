// file location: src/features/stockControl/StocktakeModal.js
//
// Guided stocktake: choose a location or category, then walk the items one at
// a time (shelf order), entering what is actually there. Each confirmed count
// is booked straight away as an audited `stocktake` movement — the difference
// from the recorded quantity is the variance — so an interrupted stocktake
// never loses counts. Finishes on a variance summary.

import React, { useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { Button, LayerTheme, StatusMessage } from "@/components/ui";
import { formatMoney, formatQuantity, toNumber } from "@/features/stockControl/stockModel";
import { ChoiceButtons, MeasureInputs, StockGauge, TextAreaField, emptyReading, readingPayload } from "@/features/stockControl/StockFields";
import { stocktakeRequest } from "@/features/stockControl/stockClient";

export default function StocktakeModal({ rows, categories, locations, capabilities, onClose, onItemUpdated }) {
  const [step, setStep] = useState("setup");
  const [scopeType, setScopeType] = useState("location");
  const [scopeId, setScopeId] = useState("");
  const [stocktake, setStocktake] = useState(null);
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [reading, setReading] = useState(emptyReading);
  const [notes, setNotes] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const activeRows = useMemo(() => rows.filter((row) => !row.archived), [rows]);
  const rowById = useMemo(() => new Map(rows.map((row) => [row.item.id, row])), [rows]);
  const scopeCount = activeRows.filter((row) =>
    scopeType === "all" ? true : scopeType === "location" ? row.item.locationId === scopeId : row.item.categoryId === scopeId
  ).length;
  const scopeOptions = (scopeType === "location" ? locations : categories)
    .filter((entry) => entry.isActive)
    .map((entry) => ({ value: entry.id, label: entry.name }));

  const call = async (body, after) => {
    setBusy(true);
    setError(null);
    try {
      const data = await stocktakeRequest(body);
      after(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    call({ action: "start", scopeType, scopeId: scopeType === "all" ? null : scopeId }, (data) => {
      setStocktake(data.stocktake);
      setQueue(data.itemIds);
      setIndex(0);
      setStep("count");
    });

  const advance = () => {
    setReading(emptyReading());
    setNotes("");
    if (index + 1 >= queue.length) setStep("summary");
    else setIndex(index + 1);
  };

  const currentRow = step === "count" ? rowById.get(queue[index]) : null;

  const confirmCount = () => {
    const before = toNumber(currentRow.item.currentQuantity);
    call({ action: "count", stocktakeId: stocktake.id, itemId: currentRow.item.id, ...readingPayload(reading), notes }, (data) => {
      onItemUpdated(data.item);
      setStocktake(data.stocktake);
      setResults((previous) => [
        ...previous.filter((result) => result.itemId !== currentRow.item.id),
        { itemId: currentRow.item.id, item: data.item, before, after: toNumber(data.item.currentQuantity), delta: toNumber(data.movement.quantityDelta) },
      ]);
      advance();
    });
  };

  const skip = () => {
    setResults((previous) => [...previous.filter((result) => result.itemId !== currentRow.item.id), { itemId: currentRow.item.id, item: currentRow.item, skipped: true }]);
    advance();
  };

  const finish = (action) =>
    call({ action, stocktakeId: stocktake.id }, () => {
      onClose();
    });

  const variances = results.filter((result) => !result.skipped && result.delta);
  const skipped = results.filter((result) => result.skipped);
  const hasInput = reading.quantity !== "" || reading.levelBand || reading.dipstickReading !== "";

  return (
    <PopupModal isOpen onClose={step === "setup" ? onClose : () => setConfirmAbandon(true)} ariaLabel="Stocktake" cardClassName="app-settings-popup-card stock-popup" closeOnBackdrop={step === "setup"}>
      <div className="app-settings-popup stock-form">
        <header className="app-popup-compact-header">
          <h2>Stocktake{stocktake?.scopeLabel ? ` — ${stocktake.scopeLabel}` : ""}</h2>
          <div className="app-popup-compact-header__actions">
            {step === "setup" && (
              <Button type="button" variant="primary" size="sm" symbol={false} busy={busy} disabled={scopeType !== "all" && !scopeId} onClick={start}>
                Start
              </Button>
            )}
            {step === "count" && (
              <>
                <Button type="button" variant="primary" size="sm" symbol={false} busy={busy} disabled={!hasInput} onClick={confirmCount}>
                  Confirm Count
                </Button>
                <Button type="button" variant="secondary" size="sm" symbol={false} disabled={busy} onClick={skip}>
                  Skip
                </Button>
              </>
            )}
            {step === "summary" && (
              <Button type="button" variant="primary" size="sm" symbol={false} busy={busy} onClick={() => finish("complete")}>
                Finish Stocktake
              </Button>
            )}
            {step === "setup" ? (
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            ) : (
              step !== "summary" && (
                <Button type="button" variant="secondary" size="sm" symbol={false} onClick={() => setConfirmAbandon(true)}>
                  Stop
                </Button>
              )
            )}
          </div>
        </header>

        {error && <StatusMessage tone="danger">{error}</StatusMessage>}

        {step === "setup" && (
          <>
            <p className="stock-hint">Walk a location or category one item at a time. Each count is saved as you go, with your name and the time.</p>
            <ChoiceButtons
              label="Count by"
              options={[
                { value: "location", label: "Location" },
                { value: "category", label: "Category" },
                { value: "all", label: "Everything" },
              ]}
              value={scopeType}
              onChange={(value) => {
                setScopeType(value || "location");
                setScopeId("");
              }}
            />
            {scopeType !== "all" && (
              <DropdownField
                label={scopeType === "location" ? "Location" : "Category"}
                options={scopeOptions}
                value={scopeId}
                onValueChange={(value) => setScopeId(value || "")}
                placeholder={`Choose a ${scopeType}`}
              />
            )}
            {(scopeType === "all" || scopeId) && <p className="stock-hint">{scopeCount} active item{scopeCount === 1 ? "" : "s"} to count.</p>}
          </>
        )}

        {step === "count" && currentRow && (
          <>
            <div className="stock-stocktake__progress">
              <span>
                Item {index + 1} of {queue.length}
              </span>
              <span>{results.filter((result) => !result.skipped).length} counted</span>
            </div>
            <LayerTheme radius="var(--radius-sm)" padding="12px" gap="8px">
              <strong className="stock-card__title">{currentRow.item.title}</strong>
              <span className="stock-card__meta">
                {[currentRow.location?.name, currentRow.category?.name, currentRow.item.oilGrade, currentRow.item.stockCode].filter(Boolean).join(" · ")}
              </span>
              <StockGauge row={currentRow} />
            </LayerTheme>
            <MeasureInputs key={currentRow.item.id} item={currentRow.item} value={reading} onChange={setReading} autoFocus />
            <TextAreaField label="Notes" value={notes} onChange={setNotes} rows={2} />
          </>
        )}
        {step === "count" && !currentRow && (
          <StatusMessage tone="warning">
            This item is no longer in the list.{" "}
            <Button type="button" variant="secondary" size="xs" symbol={false} onClick={advance}>
              Next item
            </Button>
          </StatusMessage>
        )}

        {step === "summary" && (
          <>
            <div className="stock-stocktake__compare">
              <div className="app-summary-item app-summary-item--theme">
                <span className="app-summary-label">Counted</span>
                <strong className="app-summary-value">{results.length - skipped.length}</strong>
              </div>
              <div className="app-summary-item app-summary-item--theme">
                <span className="app-summary-label">Variances</span>
                <strong className="app-summary-value">{variances.length}</strong>
              </div>
              <div className="app-summary-item app-summary-item--theme">
                <span className="app-summary-label">Skipped</span>
                <strong className="app-summary-value">{skipped.length}</strong>
              </div>
              {capabilities.viewCosts && stocktake?.varianceValue !== null && stocktake?.varianceValue !== undefined && (
                <div className="app-summary-item app-summary-item--theme">
                  <span className="app-summary-label">Variance value</span>
                  <strong className="app-summary-value">{formatMoney(stocktake.varianceValue)}</strong>
                </div>
              )}
            </div>
            {variances.length > 0 ? (
              <LayerTheme radius="var(--radius-sm)" padding="12px" gap="6px">
                {variances.map((result) => (
                  <div key={result.itemId} className="stock-row">
                    <span>{result.item.title}</span>
                    <strong>
                      {formatQuantity(result.before, result.item)} → {formatQuantity(result.after, result.item)} ({result.delta > 0 ? "+" : "−"}
                      {formatQuantity(Math.abs(result.delta), result.item)})
                    </strong>
                  </div>
                ))}
              </LayerTheme>
            ) : (
              <p className="stock-hint">Every counted item matched its record.</p>
            )}
            {skipped.length > 0 && <p className="stock-hint">Skipped: {skipped.map((result) => result.item.title).join(", ")}.</p>}
          </>
        )}
      </div>

      <ConfirmationDialog
        isOpen={confirmAbandon}
        message="Stop this stocktake? Counts already confirmed stay recorded; the rest are left as they were."
        cancelLabel="Keep counting"
        confirmLabel="Stop"
        onCancel={() => setConfirmAbandon(false)}
        onConfirm={() => {
          setConfirmAbandon(false);
          if (stocktake) finish("abandon");
          else onClose();
        }}
      />
    </PopupModal>
  );
}
