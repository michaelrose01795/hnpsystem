// file location: src/components/CustomerViewPreview.js
import React from "react";

const featureGroups = [
  {
    title: "Ownership Profile",
    items: [
      "Secure login with the booking email to access the portal.",
      "Personal dashboard shows current VHC status, quotes, and service reminders.",
      "Customers can add multiple vehicles to build a digital garage.",
    ],
  },
  {
    title: "Vehicle Health Check",
    items: [
      "Live VHC summary with traffic-light findings and media from the workshop.",
      "Direct access to the parts catalogue that matches their registered vehicles.",
      "Approve recommended work or request a call-back without leaving the page.",
    ],
  },
  {
    title: "Messaging & Support",
    items: [
      "In-app messaging routes questions to Service, Parts, or Workshop managers.",
      "Customers pick who to contact, keeping the conversation threaded to the job.",
      "Notifications email the team so responses stay on record.",
    ],
  },
  {
    title: "Parts & Extras",
    items: [
      "Browse fitted parts, accessories, and consumables tied to each VIN.",
      "One-click reorder for previously approved parts.",
      "Links back to the primary website for payment, offers, and finance options.",
    ],
  },
];

export default function CustomerViewPreview({
  portalUrl = "https://www.hpautomotive.co.uk",
  selectedPersona = "",
  selectedDepartment = "",
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5 shadow-sm space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-red-600 font-semibold">
            Customer Experience Preview
          </p>
          <h4 className="text-lg font-semibold text-gray-900">
            See what customers see before release
          </h4>
          <p className="text-sm text-gray-600">
            {selectedPersona
              ? `You are ready to impersonate ${selectedPersona} from ${selectedDepartment || "the Customer view"}.`
              : "Select a customer persona above to impersonate their portal session."}
          </p>
        </div>
        <a
          href={portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-700"
        >
          Open main website
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {featureGroups.map((group) => (
          <div key={group.title} className="rounded-lg border border-gray-200 bg-white p-4">
            <h5 className="text-sm font-semibold text-gray-900">{group.title}</h5>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {group.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-red-500">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-gray-100 p-4 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">How login works</p>
        <p>
          Customers must sign in with the email address they provided when booking their car in.
          Once verified, they can review their VHC, approve work, browse parts, and message the team
          from a single timeline. All links route back to the public website to keep the experience consistent.
        </p>
      </div>
    </div>
  );
}
