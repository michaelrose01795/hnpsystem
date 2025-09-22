// file location: src/components/Clocking/ClockInButton.js
import React from "react";
import Link from "next/link";
import { useUser } from "../../context/UserContext";

export default function ClockInButton() {
  const { user } = useUser();

  // Only show button to techs
  const techRoles = ["Service", "Workshop", "Technician"];
  if (!user || !techRoles.includes(user.role)) return null;

  return (
    <Link href="/clocking">
      <button className="w-full py-2 px-4 text-white bg-red-600 hover:bg-red-700 rounded">
        Clocking
      </button>
    </Link>
  );
}
