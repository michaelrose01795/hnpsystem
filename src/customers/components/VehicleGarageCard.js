// file location: src/customers/components/VehicleGarageCard.js
import Link from "next/link";
import React from "react";

const isVideo = (type = "") => type.toLowerCase().startsWith("video/");
const isImage = (type = "") => type.toLowerCase().startsWith("image/");

export default function VehicleGarageCard({ vehicles = [] }) {
  return (
    <section className="rounded-3xl border border-[var(--surface-light)] bg-[var(--surface)] p-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--primary)] px-4 py-3 text-white">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white">My garage</p>
          <h3 className="text-xl font-semibold text-white">Vehicles on my profile</h3>
        </div>
        <button
          type="button"
          className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
        >
          Add another vehicle
        </button>
      </header>

      <div className="mt-4 space-y-4">
        {vehicles.map((vehicle) => {
          const mediaItems = vehicle.latestVhc?.mediaItems?.slice(0, 3) || [];
          return (
            <div
              key={vehicle.id || vehicle.reg}
              className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] px-4 py-5 text-sm text-[var(--text-secondary)]"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold text-[var(--text-primary)]">
                <span>{vehicle.makeModel}</span>
                <span className="rounded-full border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                  {vehicle.reg}
                </span>
              </div>
              <div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
                <p>
                  <span className="text-[var(--text-secondary)]">VIN:</span> {vehicle.vin}
                </p>
                <p>
                  <span className="text-[var(--text-secondary)]">Mileage:</span> {vehicle.mileage} miles
                </p>
                <p>
                  <span className="text-[var(--text-secondary)]">Next service:</span> {vehicle.nextService}
                </p>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">Workshop visits</p>
                {vehicle.jobs?.length ? (
                  <ul className="mt-2 space-y-2 text-xs">
                    {vehicle.jobs.map((job) => (
                      <li
                        key={job.id}
                        className="rounded-xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[var(--text-primary)]">
                          <span className="font-semibold">{job.jobNumber}</span>
                          <span className="rounded-full bg-[var(--surface-light)] px-2 py-0.5 text-[11px] font-semibold text-[var(--danger)]">
                            {job.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                          {job.concern}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Opened {job.createdAt}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 rounded-xl border border-dashed border-[var(--surface-light)] px-3 py-4 text-center text-xs text-[var(--text-secondary)]">
                    No workshop history yet for this registration.
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">Latest VHC</p>
                    {vehicle.latestVhc ? (
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        Shared {vehicle.latestVhc.createdAt} · {vehicle.latestVhc.status}
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        Awaiting inspection
                      </p>
                    )}
                  </div>
                  {vehicle.latestVhc && (
                    <Link
                      href={`/customer/vhc?vehicle=${encodeURIComponent(vehicle.reg)}&job=${
                        vehicle.latestVhc.jobNumber || ""
                      }`}
                      className="rounded-full border border-[var(--surface-light)] bg-[var(--surface)] px-4 py-2 text-[11px] font-semibold text-[var(--primary-dark)] hover:bg-[var(--surface-muted)]"
                    >
                      View VHC
                    </Link>
                  )}
                </div>
                {vehicle.latestVhc ? (
                  <div className="mt-3 text-xs text-[var(--text-secondary)]">
                    <p>
                      <span className="font-semibold text-rose-600">{vehicle.latestVhc.redItems}</span> red ·{" "}
                      <span className="font-semibold text-amber-500">{vehicle.latestVhc.amberItems}</span> amber
                      advisories
                    </p>
                    {mediaItems.length ? (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {mediaItems.map((item) => (
                          <div
                            key={item.id}
                            className="h-20 w-24 overflow-hidden rounded-lg border border-[var(--surface-light)] bg-[var(--surface-light)]"
                          >
                            {isVideo(item.type) ? (
                              <video
                                src={item.url}
                                className="h-full w-full object-cover"
                                muted
                                playsInline
                                controls={false}
                                loop
                              />
                            ) : isImage(item.type) ? (
                              <img src={item.url} alt="VHC media" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--text-secondary)]">
                                {item.folder || "file"}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                        Media will appear once the workshop uploads it.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    We will display the inspection summary once the workshop shares it with you.
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={vehicle.accessoriesLink || `/customer/parts?vehicle=${encodeURIComponent(vehicle.reg)}`}
                  className="rounded-full border border-[var(--surface-light)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--surface-muted)]"
                >
                  View accessories
                </Link>
                <Link
                  href={vehicle.shopLink || `/customer/parts?vehicle=${encodeURIComponent(vehicle.reg)}&view=shop`}
                  className="rounded-full border border-[var(--surface-light)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--surface-muted)]"
                >
                  Shop for this vehicle
                </Link>
              </div>
            </div>
          );
        })}
        {vehicles.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--surface-light)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
            No vehicles on file yet. Use the button above to connect your car to the portal.
          </p>
        )}
      </div>
    </section>
  );
}
