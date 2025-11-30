// file location: src/customers/components/VehicleGarageCard.js
import Link from "next/link";
import React from "react";

const isVideo = (type = "") => type.toLowerCase().startsWith("video/");
const isImage = (type = "") => type.toLowerCase().startsWith("image/");

export default function VehicleGarageCard({ vehicles = [] }) {
  return (
    <section className="rounded-3xl border border-[#ffe0e0] bg-white p-5 shadow-[0_12px_34px_rgba(209,0,0,0.08)]">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">My garage</p>
          <h3 className="text-xl font-semibold text-slate-900">Vehicles on my profile</h3>
        </div>
        <button
          type="button"
          className="rounded-full border border-[#ffd0d0] px-4 py-2 text-sm font-semibold text-[#a00000] hover:bg-[#fff5f5]"
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
              className="rounded-2xl border border-[#ffe5e5] bg-[#fffafa] px-4 py-5 text-sm text-slate-700 shadow-[0_6px_20px_rgba(209,0,0,0.06)]"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold text-slate-900">
                <span>{vehicle.makeModel}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">{vehicle.reg}</span>
              </div>
              <div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
                <p>
                  <span className="text-slate-500">VIN:</span> {vehicle.vin}
                </p>
                <p>
                  <span className="text-slate-500">Mileage:</span> {vehicle.mileage} miles
                </p>
                <p>
                  <span className="text-slate-500">Next service:</span> {vehicle.nextService}
                </p>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#d10000]">Workshop visits</p>
                {vehicle.jobs?.length ? (
                  <ul className="mt-2 space-y-2 text-xs">
                    {vehicle.jobs.map((job) => (
                      <li
                        key={job.id}
                        className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-slate-900">
                          <span className="font-semibold">{job.jobNumber}</span>
                          <span className="rounded-full bg-[#fff5f5] px-2 py-0.5 text-[11px] font-semibold text-[#b91c1c]">
                            {job.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">{job.concern}</p>
                        <p className="text-[11px] text-slate-400">Opened {job.createdAt}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 rounded-xl border border-dashed border-[#ffd0d0] px-3 py-4 text-center text-xs text-slate-500">
                    No workshop history yet for this registration.
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-[#ffdede] bg-white/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#d10000]">Latest VHC</p>
                    {vehicle.latestVhc ? (
                      <p className="text-sm font-semibold text-slate-900">
                        Shared {vehicle.latestVhc.createdAt} · {vehicle.latestVhc.status}
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-slate-900">Awaiting inspection</p>
                    )}
                  </div>
                  {vehicle.latestVhc && (
                    <Link
                      href={`/customer/vhc?vehicle=${encodeURIComponent(vehicle.reg)}&job=${
                        vehicle.latestVhc.jobNumber || ""
                      }`}
                      className="rounded-full border border-[#ffd0d0] px-4 py-2 text-[11px] font-semibold text-[#a00000] hover:bg-[#fff5f5]"
                    >
                      View VHC
                    </Link>
                  )}
                </div>
                {vehicle.latestVhc ? (
                  <div className="mt-3 text-xs text-slate-600">
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
                            className="h-20 w-24 overflow-hidden rounded-lg border border-[#ffe0e0] bg-slate-100"
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
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                                {item.folder || "file"}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-slate-500">Media will appear once the workshop uploads it.</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    We will display the inspection summary once the workshop shares it with you.
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={vehicle.accessoriesLink || `/customer/parts?vehicle=${encodeURIComponent(vehicle.reg)}`}
                  className="rounded-full border border-[#ffd0d0] px-4 py-2 text-xs font-semibold text-[#a00000] hover:bg-[#fff5f5]"
                >
                  View accessories
                </Link>
                <Link
                  href={vehicle.shopLink || `/customer/parts?vehicle=${encodeURIComponent(vehicle.reg)}&view=shop`}
                  className="rounded-full border border-[#ffd0d0] px-4 py-2 text-xs font-semibold text-[#a00000] hover:bg-[#fff5f5]"
                >
                  Shop for this vehicle
                </Link>
              </div>
            </div>
          );
        })}
        {vehicles.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#ffd0d0] px-4 py-8 text-center text-sm text-slate-500">
            No vehicles on file yet. Use the button above to connect your car to the portal.
          </p>
        )}
      </div>
    </section>
  );
}
