// file location: src/pages/api/technicians/index.js
// Roster of assignable technicians with skill tags and a derived "today"
// workload, for the Scheduling dashboard → Technician Assignment section.
import { getTechnicianUsers } from "@/lib/database/users";
import {
  getTechnicianSkills,
  getTechnicianDailyLoad,
} from "@/lib/database/technicians";
import { withRoleGuard } from "@/lib/auth/roleGuard";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const roster = await getTechnicianUsers();
    const ids = roster.map((tech) => tech.id).filter((id) => id != null);

    // Treat contractedHours as weekly when it looks weekly (>= 20h), otherwise
    // assume it's already a daily figure and scale up so the helper's /5 cancels.
    const contractedHoursByUser = {};
    roster.forEach((tech) => {
      const hrs = Number(tech.contractedHours);
      if (Number.isFinite(hrs) && hrs > 0) {
        contractedHoursByUser[tech.id] = hrs >= 20 ? hrs : hrs * 5;
      }
    });

    const [skills, load] = await Promise.all([
      getTechnicianSkills(ids),
      getTechnicianDailyLoad(ids, { contractedHoursByUser }),
    ]);

    const technicians = roster.map((tech) => ({
      id: tech.id,
      name: tech.name,
      firstName: tech.firstName,
      lastName: tech.lastName,
      role: tech.role,
      jobTitle: tech.jobTitle || "",
      skills: skills[tech.id] || [],
      hoursDone: load[tech.id]?.hoursDone ?? 0,
      hoursAvailable: load[tech.id]?.hoursAvailable ?? 8,
      jobsToday: load[tech.id]?.jobsToday ?? 0,
      jobIdsToday: load[tech.id]?.jobIdsToday ?? [],
    }));

    return res.status(200).json({ success: true, technicians });
  } catch (error) {
    console.error("❌ /api/technicians error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Server error" });
  }
}

export default withRoleGuard(handler);
