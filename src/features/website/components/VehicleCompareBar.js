// file location: src/features/website/components/VehicleCompareBar.js
// The compare tray. Appears once a visitor adds a car to compare from any
// VehicleCard and stays pinned to the bottom of the viewport, on the home page
// and every stock page, until the list is cleared.
//
// Cars are resolved from the live stock list by stock number, so a car that
// sells while it sits in someone's compare list simply drops out.
//
// `previewIds` / `defaultOpen` exist for the /website/dev showcase only, which
// draws the tray inside a <Stage> without touching the visitor's shortlist.

import { useMemo, useState } from "react";
import Link from "next/link";

import useVehicleShortlist, { COMPARE_LIMIT } from "../hooks/useVehicleShortlist";
import {
  listStock,
  formatPrice,
  priceLabel,
  mileageLabel,
  stockHref,
} from "@/lib/stock/vehicleStock";

const ROWS = [
  { label: "Price", value: (v) => priceLabel(v) },
  { label: "Monthly", value: (v) => (v.monthly != null ? `${formatPrice(v.monthly)} a month` : "—") },
  { label: "Mileage", value: (v) => mileageLabel(v) },
  { label: "Year", value: (v) => v.year },
  { label: "Fuel type", value: (v) => v.fuel },
  { label: "Transmission", value: (v) => v.transmission },
  { label: "Body style", value: (v) => v.bodyStyle },
  { label: "Economy", value: (v) => (v.fuel === "Electric" ? `${v.rangeMiles} mile range` : v.mpg ? `${v.mpg} mpg` : "—") },
  { label: "Condition", value: (v) => (v.condition === "new" ? "New" : "Used") },
];

export default function VehicleCompareBar({ previewIds = null, defaultOpen = false }) {
  const shortlist = useVehicleShortlist();
  const [open, setOpen] = useState(defaultOpen);

  const ids = previewIds || shortlist.compare;
  const cars = useMemo(() => {
    const byNumber = new Map(listStock().map((v) => [v.stockNumber, v]));
    return ids.map((id) => byNumber.get(id)).filter(Boolean);
  }, [ids]);

  if (!cars.length) return null;

  const isPreview = Boolean(previewIds);
  const remove = (id) => (isPreview ? undefined : shortlist.toggleCompare(id));
  const canCompare = cars.length > 1;

  return (
    <aside className="ws-compare-bar" data-preview={isPreview ? "true" : "false"} aria-label="Compare vehicles">
      {open && canCompare ? (
        <div className="ws-compare-table-wrap">
          <table className="ws-compare-table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="ws-sr-only">Detail</span>
                </th>
                {cars.map((v) => (
                  <th key={v.stockNumber} scope="col">
                    <Link href={stockHref(v)} className="ws-compare-name">
                      {v.make} {v.model}
                    </Link>
                    <span className="ws-compare-derivative">{v.derivative}</span>
                    <button
                      type="button"
                      className="ws-stock-clear"
                      onClick={() => remove(v.stockNumber)}
                      aria-label={`Remove ${v.make} ${v.model} from compare`}
                    >
                      Remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {cars.map((v) => (
                    <td key={v.stockNumber}>{row.value(v) ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="ws-compare-bar-inner">
        <p className="ws-compare-count" aria-live="polite">
          <strong>{cars.length}</strong> of {COMPARE_LIMIT} cars selected
          {canCompare ? null : <span className="ws-compare-hint"> — add another to compare</span>}
        </p>
        <div className="ws-compare-actions">
          <button type="button" onClick={() => (isPreview ? undefined : shortlist.clearCompare())}>
            Clear
          </button>
          <button
            type="button"
            className="app-btn"
            aria-expanded={open && canCompare ? "true" : "false"}
            disabled={!canCompare}
            onClick={() => setOpen((current) => !current)}
          >
            {open && canCompare ? "Hide comparison" : "Compare"}
          </button>
        </div>
      </div>
    </aside>
  );
}
