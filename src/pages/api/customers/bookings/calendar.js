import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";

const DISPLAY_DAYS = 21;

const getStatusFromCount = (count) => {
  if (count >= 16) return "red";
  if (count >= 13) return "amber";
  return "green";
};

const buildDateRange = () => {
  const rangeStart = dayjs().startOf("day");
  return Array.from({ length: DISPLAY_DAYS }).map((_, index) => rangeStart.add(index, "day"));
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Only GET allowed" });
  }

  try {
    const dates = buildDateRange();
    const rangeStart = dates[0].startOf("day");
    const rangeEnd = dates[dates.length - 1].endOf("day");

    const { data, error } = await supabase
      .from("appointments")
      .select("scheduled_time")
      .gte("scheduled_time", rangeStart.toISOString())
      .lte("scheduled_time", rangeEnd.toISOString())
      .order("scheduled_time", { ascending: true });

    if (error) {
      console.error("Failed to load appointments for booking calendar:", error);
      throw error;
    }

    const slotMap = dates.reduce((acc, date) => {
      const iso = date.format("YYYY-MM-DD");
      acc[iso] = {
        date: iso,
        displayDate: date.format("ddd D MMM"),
        friendlyDate: date.format("dddd, D MMMM"),
        count: 0,
      };
      return acc;
    }, {});

    (data || []).forEach((row) => {
      if (!row?.scheduled_time) return;
      const dateKey = dayjs(row.scheduled_time).format("YYYY-MM-DD");
      if (!slotMap[dateKey]) return;
      slotMap[dateKey].count += 1;
    });

    const days = Object.values(slotMap).map((slot) => ({
      ...slot,
      status: getStatusFromCount(slot.count),
      isToday: slot.date === dayjs().format("YYYY-MM-DD"),
    }));

    return res.status(200).json({ days });
  } catch (error) {
    return res.status(500).json({ error: "Unable to load booking calendar" });
  }
}
