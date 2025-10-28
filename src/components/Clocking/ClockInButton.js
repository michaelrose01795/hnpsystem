// file location: src/components/Clocking/ClockInButton.js
import React from "react";
import Link from "next/link";
import { useUser } from "../../context/UserContext";
import { useClockingContext } from "../../context/ClockingContext";

export default function ClockInButton() {
  const { user, status, setStatus } = useUser();
  const { clockedIn } = useClockingContext();

  // Only show for Techs role
  if (!user || !user.roles?.includes("TECHS")) return null;

  const handleClockIn = () => {
    setStatus("In Progress"); // NEW: automatically set status
    // Optionally, redirect to clocking page
  };

  return (
    <Link href="/workshop/Clocking">
      <button
        onClick={handleClockIn}
        className="w-full py-2 px-4 text-white bg-red-600 hover:bg-red-700 rounded mt-2"
      >
        {clockedIn ? "View Clocking" : "Clock In"}
      </button>
    </Link>
  );
}