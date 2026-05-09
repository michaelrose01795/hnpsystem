// file location: src/singlescroll/components/VehicleCard.js
// Single vehicle tile — wrapped in <Card3D> for the mouse-tilt 3D effect.
// Inner card surface still uses <LayerSurface> (CLAUDE.md §3.0).

import LayerSurface from "@/components/ui/LayerSurface";
import Card3D from "./Card3D";
import styles from "../styles/singlescroll.module.css";

export default function VehicleCard({ vehicle }) {
  return (
    <Card3D className={styles.vCard3dShell}>
      <LayerSurface className={styles.vCard} padding="10px" gap="0px">
        <div className={styles.vImageWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={vehicle.image}
            alt={`${vehicle.brand} ${vehicle.model}`}
            className={styles.vImage}
            loading="lazy"
          />
          {vehicle.badge && <span className={styles.vBadge}>{vehicle.badge}</span>}
        </div>
        <div className={styles.vMeta}>
          <span className={styles.vYear}>{vehicle.year} · {vehicle.brand}</span>
          <h3 className={styles.vTitle}>{vehicle.model}</h3>
          <span className={styles.vPrice}>{vehicle.price}</span>
        </div>
      </LayerSurface>
    </Card3D>
  );
}
