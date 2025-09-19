// src/pages/workshop/VHCChecklist.js
// ==================================
// This is the VHC (Vehicle Health Check) checklist page.
// TODO previously: "Expand with all sections + connect to Job Card"
// For now: collapsible sections with placeholder fields.

import React, { useState } from "react";

export default function VHCChecklist() {
  const [vhcData, setVhcData] = useState({
    brakes: "",
    tyres: "",
    service: "",
    underside: "",
    bonnet: "",
    cosmetics: "",
    electronics: "",
  });

  const handleChange = (e) => {
    setVhcData({
      ...vhcData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = () => {
    console.log("VHC saved:", vhcData);
    alert("VHC checklist saved (placeholder only)");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6">Vehicle Health Check</h1>

      <div className="space-y-6">
        {/* Brakes */}
        <Section title="Brakes">
          <textarea
            name="brakes"
            value={vhcData.brakes}
            onChange={handleChange}
            className="w-full border rounded px-2 py-2"
            placeholder="E.g. Front pads 3mm, discs worn..."
          />
        </Section>

        {/* Tyres */}
        <Section title="Tyres">
          <textarea
            name="tyres"
            value={vhcData.tyres}
            onChange={handleChange}
            className="w-full border rounded px-2 py-2"
            placeholder="E.g. NSF 2.5mm, OSF 3mm, brand: Michelin..."
          />
        </Section>

        {/* Service reminders / Oil */}
        <Section title="Service & Oil">
          <textarea
            name="service"
            value={vhcData.service}
            onChange={handleChange}
            className="w-full border rounded px-2 py-2"
            placeholder="E.g. Oil low, service due in 2k miles..."
          />
        </Section>

        {/* Underside */}
        <Section title="Underside">
          <textarea
            name="underside"
            value={vhcData.underside}
            onChange={handleChange}
            className="w-full border rounded px-2 py-2"
            placeholder="E.g. Corrosion, exhaust condition..."
          />
        </Section>

        {/* Under Bonnet */}
        <Section title="Under Bonnet">
          <textarea
            name="bonnet"
            value={vhcData.bonnet}
            onChange={handleChange}
            className="w-full border rounded px-2 py-2"
            placeholder="E.g. Coolant level, belts, leaks..."
          />
        </Section>

        {/* Cosmetics */}
        <Section title="Cosmetics">
          <textarea
            name="cosmetics"
            value={vhcData.cosmetics}
            onChange={handleChange}
            className="w-full border rounded px-2 py-2"
            placeholder="E.g. Scratches, dents, paint chips..."
          />
        </Section>

        {/* Electronics */}
        <Section title="Electronics">
          <textarea
            name="electronics"
            value={vhcData.electronics}
            onChange={handleChange}
            className="w-full border rounded px-2 py-2"
            placeholder="E.g. Warning lights, sensors, windows..."
          />
        </Section>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          Save Checklist
        </button>
      </div>
    </div>
  );
}

// === Collapsible Section Component ===
function Section({ title, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded shadow-md">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-4 py-3 font-semibold text-left"
      >
        {title}
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="p-4 border-t">{children}</div>}
    </div>
  );
}