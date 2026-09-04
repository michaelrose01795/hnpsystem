// file location: src/components/vehicles/VehicleDetailsCard.js
// Shared "Vehicle Details" card. Extracted verbatim from the Create Job Card
// page so /new-job and /new-order render an identical card — same fields, same
// geometry, same registration lookup affordance. Page-specific wiring (where
// the lookup goes, what the notification says) arrives through props.
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import StatusMessage from "@/components/ui/StatusMessage";
import { formatUkRegistration, normalizeUkRegistrationInput } from "@/lib/vehicles/registration";

// Row each field claims when `subgrid` is on. Fixed by field name so hiding
// Engine Number or Current Mileage never shifts the rows above them.
const VEHICLE_FIELD_ROWS = { colour: 3, makeModel: 4, chassis: 5, engine: 6, mileage: 7 };

const VEHICLE_FIELD_LABELS = {
  colour: "Colour",
  makeModel: "Make & Model",
  chassis: "Chassis Number",
  engine: "Engine Number",
};

export default function VehicleDetailsCard({
  // Spacing defaults reproduce the Create Job Card layout exactly. Pages that
  // want a uniform field rhythm (registration row spaced like every other row)
  // override them; /new-job keeps the defaults.
  gap = "16px",
  registrationSpacing = "16px",
  vehicle,
  setVehicle,
  onLookup,
  isLoadingVehicle = false,
  error = "",
  notification = null,
  onDismissNotification,
  inherited = false,
  // Opt-in CSS subgrid. When on, the card becomes a grid item that shares its
  // parent's rows so its fields line up with the neighbouring cards. /new-job
  // leaves this off and renders exactly as before.
  subgrid = false,
  subgridRows = 6,
  showEngineNumber = true,
  showCurrentMileage = true,
  sectionKey,
  parentKey,
  className = "",
  style,
  children,
}) {
  const cardStyle = subgrid
    ? { ...style, display: "grid", gridTemplateRows: "subgrid", gridRow: `1 / span ${subgridRows}` }
    : style;
  const rowStyle = (row) => (subgrid ? { gridRow: row } : undefined);

  return (
    <LayerTheme
      sectionKey={sectionKey}
      sectionType="content-card"
      parentKey={parentKey}
      className={`job-cards-create-aligned-card job-cards-create-aligned-card--vehicle ${className}`.trim()}
      radius="var(--radius-md)"
      gap={gap}
      style={cardStyle}
    >
      <div className="job-cards-create-aligned-card__header" style={rowStyle(1)}>
        <h3>
          Vehicle Details
          {inherited && <span className="app-badge app-badge--accent-soft" style={{ marginLeft: "8px" }}>
              Inherited
            </span>}
        </h3>

        {notification && <StatusMessage tone={notification.type === "success" ? "success" : "danger"} style={{
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span>{notification.message}</span>
          <Button type="button" variant="ghost" size="xs" className="app-btn--icon" onClick={() => onDismissNotification?.(null)} style={{
            marginLeft: "auto"
          }} aria-label="Dismiss vehicle notification">
            ×
            </Button>
          </StatusMessage>}
      </div>

      <div className="job-cards-create-aligned-row job-cards-create-vehicle-row--registration" style={{
        marginBottom: registrationSpacing,
        ...rowStyle(2)
      }}>
        <label htmlFor="vehicle-registration">
          Registration Number
        </label>
        <div style={{
          display: "flex",
          gap: "12px",
          alignItems: "center"
        }}>
          <input id="vehicle-registration" type="text" value={formatUkRegistration(vehicle.reg)} onChange={e => setVehicle(currentVehicle => ({
            ...currentVehicle,
            reg: normalizeUkRegistrationInput(e.target.value)
          }))} placeholder="e.g. AB12 CDE" className="app-input" style={{ flex: 1 }} maxLength={9} autoCapitalize="characters" spellCheck={false} />
          <Button type="button" data-presentation="create-reg-lookup" onClick={onLookup} busy={isLoadingVehicle}>
            {isLoadingVehicle ? "Loading..." : "Search"}
          </Button>
        </div>
        {error && <StatusMessage tone="danger">
            {error}
          </StatusMessage>}
      </div>

      <div className="job-cards-create-vehicle-fields" style={subgrid ? { display: "contents" } : {
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
        {["colour", "makeModel", "chassis", ...(showEngineNumber ? ["engine"] : [])].map((key, idx) => (
          <div key={`${key}-${idx}`} className={`job-cards-create-aligned-row job-cards-create-vehicle-row--${key}`} style={rowStyle(VEHICLE_FIELD_ROWS[key])}>
            <label htmlFor={`vehicle-${key}`}>
              {VEHICLE_FIELD_LABELS[key]}
            </label>
            <input id={`vehicle-${key}`} className="app-input" value={vehicle[key] || "Not available"} readOnly />
          </div>
        ))}

        {showCurrentMileage ? (
          <div className="job-cards-create-aligned-row job-cards-create-vehicle-row--mileage" style={rowStyle(VEHICLE_FIELD_ROWS.mileage)}>
            <label htmlFor="vehicle-mileage">
              Current Mileage
            </label>
            <input id="vehicle-mileage" type="number" value={vehicle.mileage} onChange={e => setVehicle({
              ...vehicle,
              mileage: e.target.value
            })} placeholder="Enter mileage" className="app-input" />
          </div>
        ) : null}
      </div>

      {children}
    </LayerTheme>
  );
}
