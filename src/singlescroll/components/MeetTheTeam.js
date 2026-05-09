// file location: src/singlescroll/components/MeetTheTeam.js
// 21 team members across Management / Sales / Aftersales / Admin. Filterable
// by department; each member card has a Card3D mouse-tilt.

import { useMemo, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import Card3D from "./Card3D";
import { team, teamDepartments } from "../data/team";
import SectionHeading from "./SectionHeading";
import styles from "../styles/singlescroll.module.css";

const FILTERS = [{ id: "all", label: "Everyone" }, ...teamDepartments];

export default function MeetTheTeam() {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(
    () => (filter === "all" ? team : team.filter((m) => m.department === filter)),
    [filter],
  );

  return (
    <section id="team" className={`${styles.section} ${styles.teamSection}`} aria-label="Meet the team">
      <SectionHeading
        number="08"
        eyebrow="Meet the Team"
        title="The 21 people who actually do the looking-after"
        lead="The H&P family. Some of them have been here decades; some joined this year. They all answer to the same phone."
      />

      <div className={styles.galleryFilters} data-reveal>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`${styles.filterTab} ${filter === f.id ? styles.filterTabActive : ""}`}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={styles.teamGrid}>
        {filtered.map((member) => (
          <div key={member.id} data-reveal>
            <Card3D intensity={0.6}>
              <LayerSurface className={styles.teamCard} padding="0">
                <div className={styles.teamPhotoWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={member.photo}
                    alt={member.name}
                    className={styles.teamPhoto}
                    loading="lazy"
                  />
                </div>
                <div className={styles.teamMeta}>
                  <h3 className={styles.teamName}>{member.name}</h3>
                  <span className={styles.teamRole}>{member.role}</span>
                </div>
              </LayerSurface>
            </Card3D>
          </div>
        ))}
      </div>
    </section>
  );
}
