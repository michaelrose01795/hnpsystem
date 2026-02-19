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
        className="w-full py-2 px-4 text-white rounded mt-2 transition-colors"
        style={{ backgroundColor: "var(--danger)" }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--danger-hover)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--danger)"; }}
      >
        {clockedIn ? "View Clocking" : "Clock In"}
      </button>
    </Link>
  );
}
