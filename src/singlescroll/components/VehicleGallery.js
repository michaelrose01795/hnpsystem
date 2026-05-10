// file location: src/singlescroll/components/VehicleGallery.js
// Vehicle gallery — the "Our Cars" chapter of the single-scroll site.
//
// Redesigned to share the diorama section language: centered numbered
// head, big "DRIVE" ghost backdrop, premium scene chips for the
// new/used/all filters, and the existing 3D-tilted vehicle cards
// laid out in a generous responsive grid.
//
// Top-nav New / Used buttons drive the filter via the `filter` /
// `onFilterChange` props lifted in WebsitePage.

import { useMemo } from "react";
import { vehicles } from "../data/vehicles";
import VehicleCard from "./VehicleCard";
import SceneShell from "./SceneShell";
import styles from "../styles/singlescroll.module.css";

const TABS = [
  { id: "all", label: "All cars" },
  { id: "new", label: "New" },
  { id: "used", label: "Used" },
];

export default function VehicleGallery({ filter, onFilterChange }) {
  const filtered = useMemo(() => {
    if (!filter || filter === "all") return vehicles;
    return vehicles.filter((v) => v.type === filter);
  }, [filter]);

  return (
    <SceneShell
      id="cars"
      number="01"
      eyebrow="Our Cars"
      title="Find your next car at Humphries & Parks"
      lead="Every used car arrives with a 120-point inspection, a minimum 6-month MOT, and a free 6-month warranty. New Suzuki, KGM and Mitsubishi available with manufacturer offers."
      backdrop="Drive"
      tone="surface"
      ariaLabel="Our cars"
    >
      <div className={styles.sceneChips} data-reveal>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`app-btn ${styles.sceneChip} ${
              (filter || "all") === tab.id ? styles.sceneChipActive : ""
            }`}
            onClick={() => onFilterChange(tab.id)}
            aria-pressed={(filter || "all") === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.galleryGrid}>
        {filtered.map((v) => (
          <div key={v.id} data-reveal>
            <VehicleCard vehicle={v} />
          </div>
        ))}
      </div>
    </SceneShell>
  );
}
