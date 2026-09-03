// Route planning, automatic ordering and navigation hand-off for /deliveries.

import React, { useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import {
  buildGoogleMapsRouteUrls,
  calculateRouteFinishTime,
  formatRouteDuration,
} from "@/features/deliveries/routeGuidance";
import { deliveryStyles, deliveryText } from "./deliveryStyles";

export default function DeliveryRouteSettingsModal({
  capabilities,
  deliveries,
  map,
  onClose,
  onOptimise,
}) {
  const [leaveTime, setLeaveTime] = useState("08:30");
  const [minutesPerStop, setMinutesPerStop] = useState(10);
  const [avoidMotorways, setAvoidMotorways] = useState(false);
  const [optimising, setOptimising] = useState(false);
  const [result, setResult] = useState(null);
  const [previousMiles, setPreviousMiles] = useState(null);
  const [error, setError] = useState("");

  const route = result || map;
  const driveMinutes = Number(route?.totalMinutes);
  const finishTime = calculateRouteFinishTime(
    leaveTime,
    driveMinutes,
    deliveries.length,
    Number(minutesPerStop)
  );
  const guidanceUrls = useMemo(
    () => buildGoogleMapsRouteUrls(deliveries, map?.origin?.postcode, avoidMotorways),
    [avoidMotorways, deliveries, map?.origin?.postcode]
  );
  const notices = result?.notices || [
    "Live traffic is checked by Google Maps when guidance opens; it is not included in the planner estimate.",
  ];
  // How much the calculation actually helped. Minutes come from the optimiser
  // itself — it compares the new order with the previous one inside a single
  // drive-time matrix, so the two numbers are directly comparable. The mileage
  // difference is only used when the optimiser could not report minutes, since
  // that figure is measured against the route map's own separate calculation
  // and a fraction of a mile either way would read as a change that never
  // happened.
  const savedMinutes = Number.isFinite(Number(result?.savedMinutes))
    ? Number(result.savedMinutes)
    : null;
  const savedMiles =
    savedMinutes === null && result && Number.isFinite(previousMiles) && Number.isFinite(Number(result.totalMiles))
      ? Math.round((previousMiles - Number(result.totalMiles)) * 10) / 10
      : null;
  const difference =
    savedMinutes !== null
      ? savedMinutes > 0
        ? `About ${savedMinutes} minute(s) shorter`
        : "Already the best order found"
      : savedMiles !== null
      ? savedMiles > 0
        ? `${savedMiles} miles saved`
        : savedMiles < 0
        ? `${Math.abs(savedMiles)} miles longer`
        : "No mileage change"
      : null;

  const optimise = async () => {
    setOptimising(true);
    setError("");
    setPreviousMiles(Number.isFinite(Number(map?.totalMiles)) ? Number(map.totalMiles) : null);
    try {
      const next = await onOptimise({ avoidMotorways });
      setResult(next);
    } catch (optimiseError) {
      setError(optimiseError?.message || "The route could not be calculated.");
    } finally {
      setOptimising(false);
    }
  };

  const openGuidance = (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <PopupModal
      isOpen
      onClose={optimising ? undefined : onClose}
      closeOnBackdrop={!optimising}
      ariaLabel="Delivery route settings"
      cardClassName="app-settings-popup-card"
      cardStyle={{ width: "min(780px, 100%)", padding: "var(--page-card-padding)", overflow: "hidden" }}
    >
      <div className="app-settings-popup" style={deliveryStyles.modalBodyWide}>
        <header className="app-popup-compact-header">
          <div style={deliveryStyles.cell}>
            <h2 style={{ margin: 0 }}>Route settings</h2>
            <span style={deliveryText.muted}>Plan the run, estimate timings and open guidance.</span>
          </div>
          <div className="app-popup-compact-header__actions">
            <Button
              variant="primary"
              size="sm"
              busy={optimising}
              disabled={optimising || !capabilities?.reorder || deliveries.length < 2}
              onClick={optimise}
            >
              Auto-calculate route
            </Button>
            <Button variant="secondary" size="sm" disabled={optimising} onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        <div style={deliveryStyles.modalScroll}>
          {error ? <div className="app-status-message app-status-message--danger">{error}</div> : null}
          {result ? (
            <div className="app-status-message app-status-message--success">
              Route updated. Stop numbers can still be rearranged by dragging the route list.
            </div>
          ) : null}

          <LayerTheme
            as="section"
            sectionKey="parts-deliveries-route-timing"
            parentKey="shared-popup-card"
            gap="var(--layout-card-gap)"
          >
            <h3 style={{ margin: 0 }}>Timing</h3>
            <div style={deliveryStyles.routeSettingsGrid}>
              <label style={deliveryStyles.cell}>
                <span style={deliveryText.label}>Leave time</span>
                <input
                  className="app-input"
                  type="time"
                  value={leaveTime}
                  onChange={(event) => setLeaveTime(event.target.value)}
                />
              </label>
              <label style={deliveryStyles.cell}>
                <span style={deliveryText.label}>Minutes at each stop</span>
                <input
                  className="app-input"
                  type="number"
                  min="0"
                  max="120"
                  step="5"
                  value={minutesPerStop}
                  onChange={(event) => setMinutesPerStop(Number(event.target.value))}
                />
              </label>
              <div style={deliveryStyles.cell}>
                <span style={deliveryText.label}>Driving time</span>
                <strong style={deliveryText.valueStrong}>{formatRouteDuration(driveMinutes)}</strong>
              </div>
              <div style={deliveryStyles.cell}>
                <span style={deliveryText.label}>Estimated finish</span>
                <strong style={deliveryText.valueStrong}>{finishTime || "Not available"}</strong>
              </div>
              {difference ? (
                <div style={deliveryStyles.cell}>
                  <span style={deliveryText.label}>Route difference</span>
                  <strong style={deliveryText.valueStrong}>{difference}</strong>
                </div>
              ) : null}
            </div>
          </LayerTheme>

          <LayerTheme
            as="section"
            sectionKey="parts-deliveries-route-guidance"
            parentKey="shared-popup-card"
            gap="var(--layout-card-gap)"
          >
            <div style={deliveryStyles.headerTopRow}>
              <div style={deliveryStyles.cell}>
                <h3 style={{ margin: 0 }}>Route guidance</h3>
                <span style={deliveryText.muted}>
                  {/* Number(null) is 0 and passes isFinite, so the mileage is
                      type-checked rather than coerced — the optimiser returns
                      null when the routing provider gave times without
                      distances, and "0 miles" would be a lie. */}
                  {deliveries.length} stops ·{" "}
                  {typeof route?.totalMiles === "number" && Number.isFinite(route.totalMiles)
                    ? `${route.totalMiles} miles`
                    : "mileage unavailable"}
                </span>
              </div>
              <label style={deliveryStyles.toggleLabel}>
                <input
                  className="app-toggle app-toggle--checkbox"
                  type="checkbox"
                  checked={avoidMotorways}
                  onChange={(event) => setAvoidMotorways(event.target.checked)}
                />
                <span style={deliveryText.value}>Avoid motorways</span>
              </label>
            </div>
            <div style={deliveryStyles.detailActions}>
              {guidanceUrls.map((url, index) => (
                <Button key={url} variant="secondary" onClick={() => openGuidance(url)}>
                  {guidanceUrls.length === 1
                    ? "Open in Google Maps"
                    : `Open route ${index + 1} of ${guidanceUrls.length}`}
                </Button>
              ))}
            </div>
            {!guidanceUrls.length ? (
              <span style={deliveryText.muted}>Add valid postcodes before opening route guidance.</span>
            ) : null}
          </LayerTheme>

          <LayerTheme
            as="section"
            sectionKey="parts-deliveries-route-notifications"
            parentKey="shared-popup-card"
            gap="var(--space-sm)"
          >
            <h3 style={{ margin: 0 }}>Route notifications</h3>
            {notices.map((notice) => (
              <div key={notice} className="app-status-message app-status-message--warning">
                {notice}
              </div>
            ))}
            {guidanceUrls.length > 1 ? (
              <div className="app-status-message app-status-message--warning">
                Google Maps limits route waypoints, so this run opens in {guidanceUrls.length} ordered sections.
              </div>
            ) : null}
          </LayerTheme>
        </div>
      </div>
    </PopupModal>
  );
}
