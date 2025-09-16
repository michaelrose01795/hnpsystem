// components/Sidebar.js
import Link from "next/link";
import { useState } from "react";

// Example role-based config
const menuConfig = {
  admin: [
    {
      label: "Dashboard",
      items: [{ name: "Overview", path: "/" }],
    },
    {
      label: "Accounts",
      items: [
        { name: "User Management", path: "/accounts" },
        { name: "Edit Profile", path: "/accounts/edit" },
      ],
    },
    {
      label: "Workshop",
      items: [
        { name: "Job Cards", path: "/workshop/jobcards" },
        { name: "Clocking", path: "/workshop/clocking" },
      ],
    },
  ],
  technician: [
    {
      label: "Workshop",
      items: [
        { name: "My Jobs", path: "/workshop/jobs" },
        { name: "Clock In/Out", path: "/workshop/clocking" },
      ],
    },
  ],
};

export default function Sidebar({ role = "admin" }) {
  const [openMenu, setOpenMenu] = useState(null);

  return (
    <aside className="w-64 bg-[var(--color-box)] text-gray-800 p-4">
      <h1 className="text-xl font-bold text-[var(--color-accent)] mb-6">
        H&amp;P System
      </h1>
      {menuConfig[role].map((menu, idx) => (
        <div key={idx} className="mb-4">
          <button
            className="w-full text-left font-semibold text-gray-700"
            onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
          >
            {menu.label}
          </button>
          {openMenu === idx && (
            <ul className="mt-2 ml-2 space-y-1">
              {menu.items.map((item, i) => (
                <li key={i}>
                  <Link
                    href={item.path}
                    className="block px-2 py-1 rounded hover:bg-[var(--color-accent)] hover:text-white"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </aside>
  );
}
