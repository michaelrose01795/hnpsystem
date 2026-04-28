// ✅ Imports converted to use absolute alias "@/"
import React from "react";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { useClockingContext } from "@/context/ClockingContext";
import { Button } from "@/components/ui";

export default function ClockInButton() {
  const { user, setStatus } = useUser();
  const { clockedIn } = useClockingContext();

  if (!user || !user.roles?.includes("TECHS")) return null;

  const handleClockIn = () => {
    setStatus("In Progress"); // auto-set status
  };

  return (
    <Link href="/workshop/Clocking">
      <Button
        onClick={handleClockIn}
        className="w-full"
        style={{ marginTop: "var(--space-2)", background: "var(--danger)", borderColor: "transparent" }}
      >
        {clockedIn ? "View Clocking" : "Clock In"}
      </Button>
    </Link>
  );
}
