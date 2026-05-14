// file location: src/singlescroll/components/MeetTheTeam.js
// Continuation of the About chapter — 21 team members across
// Management / Sales / Aftersales / Admin. Filterable by department;
// each card is wrapped in Card3D for the mouse-tilt 3D effect.
// Rendered without a section id (the About Us nav anchors above).

import { useMemo, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import Card3D from "./Card3D";
import { team, teamDepartments } from "../data/team";
import styles from "../styles/singlescroll.module.css";

const FILTERS = [{ id: "all", label: "Everyone" }, ...teamDepartments];

export default function MeetTheTeam() {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(
    () => (filter === "all" ? team : team.filter((m) => m.department === filter)),
    [filter],
  );

  return (
    <section className={`${styles.section} ${styles.teamSection}`} aria-label="Meet the team">
      <header className={styles.subSceneHead} data-reveal>
        <span className={styles.subSceneEyebrow}>Meet the Team</span>
        <h3 className={styles.subSceneTitle}>The 21 people who actually do the looking-after</h3>
        <p className={styles.subSceneLead}>
          The H&amp;P family. Some have been here decades; some joined this year. They all answer to the same phone.
        </p>
      </header>

      <div className={styles.sceneChips} data-reveal>
        {FILTERS.map((f) => {
          const isActive = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              className={isActive ? "app-btn" : ""}
              onClick={() => setFilter(f.id)}
              aria-pressed={isActive}
            >
              {f.label}
            </button>
          );
        })}
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
                  <h4 className={styles.teamName}>{member.name}</h4>
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
