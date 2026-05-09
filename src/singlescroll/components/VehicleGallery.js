// file location: src/singlescroll/components/VehicleGallery.js
// Vehicle gallery with internal New / Used / All filter tabs (these don't
// scroll — they're pure state). Top-nav New/Used tabs lift the filter into
// state via the `filter` / `onFilterChange` props from WebsitePage.

import { useMemo } from "react";
import { vehicles } from "../data/vehicles";
import VehicleCard from "./VehicleCard";
import SectionHeading from "./SectionHeading";
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
    <section id="cars" className={styles.section}>
      <SectionHeading
        eyebrow="Our Cars"
        title="Find your next car at Humphries & Parks"
        lead="Every used car arrives with a 120-point inspection, a minimum 6-month MOT, and a free 6-month warranty. New Suzuki, KGM and Mitsubishi available with manufacturer offers."
      />

      <div className={styles.galleryFilters} data-reveal>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.filterTab} ${
              filter === tab.id ? styles.filterTabActive : ""
            }`}
            onClick={() => onFilterChange(tab.id)}
            aria-pressed={filter === tab.id}
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
    </section>
  );
}
