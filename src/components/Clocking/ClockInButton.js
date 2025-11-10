// ✅ Imports converted to use absolute alias "@/"
import React from "react";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { useClockingContext } from "@/context/ClockingContext";

export default function ClockInButton() {
  const { user, setStatus } = useUser();
  const { clockedIn } = useClockingContext();

  if (!user || !user.roles?.includes("TECHS")) return null;

  const handleClockIn = () => {
    setStatus("In Progress"); // auto-set status
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