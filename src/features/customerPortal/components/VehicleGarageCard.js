// file location: src/features/customerPortal/components/VehicleGarageCard.js
import Link from "next/link";
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

const isVideo = (type = "") => type.toLowerCase().startsWith("video/");
const isImage = (type = "") => type.toLowerCase().startsWith("image/");

function FactTile({ label, value }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: 0,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.65rem",
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: "var(--text-1)",
          opacity: 0.7,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--text-1)",
          wordBreak: "break-word",
        }}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function MediaTile({ item }) {
  return (
    <div
      style={{
        height: "80px",
        width: "96px",
        overflow: "hidden",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        flexShrink: 0,
      }}
    >
      {isVideo(item.type) ? (
        <video
          src={item.url}
          muted
          playsInline
          loop
          style={{ height: "100%", width: "100%", objectFit: "cover" }}
        />
      ) : isImage(item.type) ? (
        <img
          src={item.url}
          alt="VHC media"
          style={{ height: "100%", width: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            height: "100%",
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.65rem",
            color: "var(--text-1)",
          }}
        >
          {item.folder || "file"}
        </div>
      )}
    </div>
  );
}

export default function VehicleGarageCard({ vehicles = [] }) {
  return (
    <LayerSurface
      as="section"
      sectionKey="customer-vehicle-garage"
      sectionType="content-card"
      radius="var(--page-card-radius)"
      padding="var(--section-card-padding)"
      gap="var(--space-4)"
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          background: "var(--primary)",
          color: "var(--text-2)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.3em",
              color: "var(--text-2)",
              opacity: 0.9,
            }}
          >
            My garage
          </p>
          <h3
            style={{
              margin: 0,
              fontSize: "1.15rem",
              fontWeight: 600,
              color: "var(--text-2)",
            }}
          >
            Vehicles on my profile
          </h3>
        </div>
        <Link
          href={{
            pathname: "/customer/messages",
            query: { subject: "Add another vehicle to my profile" },
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "var(--radius-pill)",
            background: "rgba(var(--text-2-rgb), 0.18)",
            color: "var(--text-2)",
            fontSize: "0.8rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Add another vehicle
        </Link>
      </header>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        {vehicles.map((vehicle) => {
          const mediaItems = vehicle.latestVhc?.mediaItems?.slice(0, 3) || [];
          return (
            <LayerTheme
              key={vehicle.id || vehicle.reg}
              radius="var(--radius-md)"
              padding="var(--space-4)"
              gap="var(--space-3)"
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "var(--text-1)",
                  }}
                >
                  {vehicle.makeModel}
                </p>
                <span
                  className="app-badge app-badge--accent-soft"
                  style={{ fontSize: "0.7rem" }}
                >
                  {vehicle.reg}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "var(--space-2)",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
                }}
              >
                <FactTile label="VIN" value={vehicle.vin} />
                <FactTile label="Mileage" value={vehicle.mileage ? `${vehicle.mileage} miles` : null} />
                <FactTile label="Next service" value={vehicle.nextService} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: "var(--text-accent)",
                  }}
                >
                  Workshop visits
                </p>
                {vehicle.jobs?.length ? (
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {vehicle.jobs.map((job) => (
                      <li
                        key={job.id}
                        style={{
                          background: "var(--surface)",
                          borderRadius: "var(--radius-md)",
                          padding: "10px 12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                          }}
                        >
                          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-1)" }}>
                            {job.jobNumber}
                          </span>
                          <span className="app-badge app-badge--danger-soft">{job.status}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-1)" }}>
                          {job.concern}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.7rem",
                            color: "var(--text-1)",
                            opacity: 0.7,
                          }}
                        >
                          Opened {job.createdAt}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p
                    style={{
                      margin: 0,
                      padding: "var(--space-3)",
                      textAlign: "center",
                      fontSize: "0.75rem",
                      color: "var(--text-1)",
                      background: "var(--surface)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    No workshop history yet for this registration.
                  </p>
                )}
              </div>

              <LayerSurface
                radius="var(--radius-md)"
                padding="var(--space-4)"
                gap="var(--space-3)"
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.18em",
                        color: "var(--text-accent)",
                      }}
                    >
                      Latest VHC
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--text-1)",
                      }}
                    >
                      {vehicle.latestVhc
                        ? `Shared ${vehicle.latestVhc.createdAt} · ${vehicle.latestVhc.status}`
                        : "Awaiting inspection"}
                    </p>
                  </div>
                  {vehicle.latestVhc && (
                    <Link
                      href={`/customer/vhc?vehicle=${encodeURIComponent(vehicle.reg)}&job=${
                        vehicle.latestVhc.jobNumber || ""
                      }`}
                      className="app-btn app-btn--secondary"
                    >
                      View VHC
                    </Link>
                  )}
                </div>
                {vehicle.latestVhc ? (
                  <>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.8rem",
                        color: "var(--text-1)",
                      }}
                    >
                      <span style={{ color: "var(--dangerMain)", fontWeight: 600 }}>
                        {vehicle.latestVhc.redItems}
                      </span>{" "}
                      red ·{" "}
                      <span style={{ color: "var(--warningMain)", fontWeight: 600 }}>
                        {vehicle.latestVhc.amberItems}
                      </span>{" "}
                      amber advisories
                    </p>
                    {mediaItems.length ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "var(--space-2)",
                        }}
                      >
                        {mediaItems.map((item) => (
                          <MediaTile key={item.id} item={item} />
                        ))}
                      </div>
                    ) : (
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.7rem",
                          color: "var(--text-1)",
                          opacity: 0.75,
                        }}
                      >
                        Media will appear once the workshop uploads it.
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-1)" }}>
                    We will display the inspection summary once the workshop shares it with you.
                  </p>
                )}
              </LayerSurface>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <Link
                  href={
                    vehicle.accessoriesLink ||
                    `/customer/parts?vehicle=${encodeURIComponent(vehicle.reg)}`
                  }
                  className="app-btn app-btn--secondary"
                >
                  View accessories
                </Link>
                <Link
                  href={
                    vehicle.shopLink ||
                    `/customer/parts?vehicle=${encodeURIComponent(vehicle.reg)}&view=shop`
                  }
                  className="app-btn app-btn--secondary"
                >
                  Shop for this vehicle
                </Link>
              </div>
            </LayerTheme>
          );
        })}
        {vehicles.length === 0 && (
          <p
            style={{
              margin: 0,
              padding: "var(--space-4) var(--space-3)",
              textAlign: "center",
              fontSize: "0.875rem",
              color: "var(--text-1)",
              background: "var(--theme)",
              borderRadius: "var(--radius-md)",
            }}
          >
            No vehicles on file yet. Use the button above to connect your car to the portal.
          </p>
        )}
      </div>
    </LayerSurface>
  );
}
