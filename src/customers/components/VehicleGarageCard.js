// file location: src/customers/components/VehicleGarageCard.js
import React from "react";

export default function VehicleGarageCard({ vehicles = [] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-rose-500">My garage</p>
          <h3 className="text-xl font-semibold text-slate-900">Vehicles on my profile</h3>
        </div>
        <button
          type="button"
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Add another vehicle
        </button>
      </header>

      <div className="mt-4 space-y-3">
        {vehicles.map((vehicle) => (
          <div
            key={vehicle.id}
            className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm text-slate-700"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold text-slate-900">
              <span>{vehicle.makeModel}</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">
                {vehicle.reg}
              </span>
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
          </div>
        ))}
        {vehicles.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            No vehicles on file yet. Use the button above to connect your car to the portal.
          </p>
        )}
      </div>
    </section>
  );
}
