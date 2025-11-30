// file location: src/customers/hooks/useCustomerPortalData.js
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";

const buildContacts = (usersByRole = {}) => [
  {
    id: "service",
    label: "Service Team",
    name: (usersByRole["Service"] || ["Service Advisor"])[0] || "Service Advisor",
  },
  {
    id: "parts",
    label: "Parts Desk",
    name: (usersByRole["Parts"] || ["Parts Coordinator"])[0] || "Parts Coordinator",
  },
  {
    id: "sales",
    label: "Retail Sales",
    name: (usersByRole["Sales"] || ["Retail Sales"])[0] || "Retail Sales",
  },
];

const mapVehicleRow = (row) => ({
  id: row.vehicle_id,
  reg: (row.registration || row.reg_number || "").toUpperCase(),
  makeModel: row.make_model || [row.make, row.model].filter(Boolean).join(" "),
  vin: row.vin || "N/A",
  mileage: row.mileage || "—",
  nextService: row.mot_due || "TBC",
});

const mapPartsRow = (row, vehicles) => {
  const appliesTo = vehicles.length ? vehicles.map((vehicle) => vehicle.reg) : ["Your vehicles"];
  const price = row.unit_price ? `£${Number(row.unit_price).toFixed(2)}` : "Price on request";
  const availability = row.qty_in_stock > 0 ? `In stock - ${row.qty_in_stock}` : "Back order";
  return {
    id: row.id,
    title: row.name || row.part_number || "Part",
    appliesTo,
    price,
    availability,
  };
};

const mapVhcRow = (row, mediaItems = []) => ({
  id: `vhc-${row.job_id}`,
  jobId: row.job_id,
  jobNumber: row.job_number,
  vehicleId: (row.vehicle_reg || "").toUpperCase(),
  createdAt: dayjs(row.last_sent_at || row.vhc_sent_at || row.updated_at || row.created_at || new Date()).format(
    "YYYY-MM-DD"
  ),
  createdAtRaw: row.last_sent_at || row.vhc_sent_at || row.updated_at || row.created_at || new Date().toISOString(),
  status: row.status || "In progress",
  amberItems: Math.max(0, (row.vhc_checks_count || 0) - (row.authorization_count || 0)),
  redItems: row.authorization_count || 0,
  mediaCount: mediaItems.length,
  mediaItems,
});

const mapTimeline = (history = []) =>
  history.slice(-4).map((entry) => ({
    id: entry.id,
    label: entry.status?.label || entry.to_status || "Status updated",
    timestamp: dayjs(entry.changed_at).format("DD MMM · HH:mm"),
    description: entry.reason || `Moved to ${entry.to_status || "new status"}.`,
  }));

export function useCustomerPortalData() {
  const { user } = useUser();
  const { usersByRole } = useRoster();
  const [state, setState] = useState({
    isLoading: true,
    error: null,
    customer: null,
    vehicles: [],
    jobs: [],
    vhcSummaries: [],
    parts: [],
    timeline: [],
    contacts: buildContacts(usersByRole),
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const normalizedEmail = user.email?.trim().toLowerCase();
        let customerRow = null;

        if (normalizedEmail) {
          const { data, error } = await supabase
            .from("customers")
            .select("id, firstname, lastname, email")
            .ilike("email", normalizedEmail)
            .maybeSingle();

          if (error && error.code !== "PGRST116") throw error;
          customerRow = data || null;
        }

        if (!customerRow) {
          const { data } = await supabase
            .from("customers")
            .select("id, firstname, lastname, email")
            .order("created_at", { ascending: true })
            .limit(1);
          customerRow = data?.[0] || null;
        }

        if (!customerRow) {
          throw new Error("No customer profile linked to this account.");
        }

        const { data: vehiclesData } = await supabase
          .from("vehicles")
          .select(
            "vehicle_id, registration, reg_number, make, model, make_model, vin, mileage, mot_due, customer_id"
          )
          .eq("customer_id", customerRow.id)
          .order("created_at", { ascending: false });

        const vehicles = (vehiclesData || []).map(mapVehicleRow);

        const { data: jobsData } = await supabase
          .from("jobs")
          .select(
            "id, job_number, status, description, job_concern, vehicle_reg, created_at, updated_at, customer_id"
          )
          .eq("customer_id", customerRow.id)
          .order("created_at", { ascending: false });

        const jobIds = (jobsData || []).map((job) => job.id);

        let vhcMediaByJob = {};
        if (jobIds.length) {
          const { data: mediaRows } = await supabase
            .from("job_files")
            .select("job_id, file_id, file_url, file_type, folder, uploaded_at")
            .in("job_id", jobIds)
            .in("folder", ["vhc", "vhc_reports", "vhc-media", "vhc_photos"]);
          if (mediaRows) {
            vhcMediaByJob = mediaRows.reduce((acc, file) => {
              const entry = {
                id: file.file_id,
                url: file.file_url,
                type: file.file_type,
                folder: file.folder,
                uploadedAt: file.uploaded_at,
              };
              if (!acc[file.job_id]) acc[file.job_id] = [];
              acc[file.job_id].push(entry);
              return acc;
            }, {});
          }
        }

        let vhcSummaries = [];
        let vhcSummaryByJobId = {};
        if (jobIds.length) {
          const { data: vhcRows } = await supabase
            .from("vhc_workflow_status")
            .select(
              "job_id, job_number, status, vhc_checks_count, authorization_count, vehicle_reg, created_at, updated_at, vhc_sent_at, last_sent_at"
            )
            .in("job_id", jobIds);
          vhcSummaries = (vhcRows || []).map((row) => {
            const mapped = mapVhcRow(row, vhcMediaByJob[row.job_id] || []);
            vhcSummaryByJobId[row.job_id] = mapped;
            return mapped;
          });
        }

        const jobsByVehicle = {};
        (jobsData || []).forEach((job) => {
          const regKey = (job.vehicle_reg || "").toUpperCase();
          if (!regKey) return;
          const entry = {
            id: job.id,
            jobNumber: job.job_number,
            status: job.status || "Open",
            concern: job.job_concern || job.description || "Workshop visit",
            createdAt: dayjs(job.created_at).format("DD MMM YYYY"),
            createdAtRaw: job.created_at,
            updatedAt: job.updated_at,
          };
          if (!jobsByVehicle[regKey]) {
            jobsByVehicle[regKey] = [];
          }
          jobsByVehicle[regKey].push(entry);
        });

        const vehiclesWithHistory = vehicles.map((vehicle) => {
          const vehicleJobs = (jobsByVehicle[vehicle.reg] || []).sort(
            (a, b) => new Date(b.createdAtRaw) - new Date(a.createdAtRaw)
          );
          const latestVhc = vehicleJobs
            .map((job) => vhcSummaryByJobId[job.id])
            .filter(Boolean)
            .sort((a, b) => new Date(b.createdAtRaw) - new Date(a.createdAtRaw))[0] || null;

          return {
            ...vehicle,
            jobs: vehicleJobs,
            latestVhc,
            accessoriesLink: `/customer/parts?vehicle=${encodeURIComponent(vehicle.reg)}&view=accessories`,
            shopLink: `/customer/parts?vehicle=${encodeURIComponent(vehicle.reg)}&view=shop`,
          };
        });

        const { data: partsData } = await supabase
          .from("parts_catalog")
          .select("id, name, part_number, unit_price, qty_in_stock, updated_at")
          .order("updated_at", { ascending: false })
          .limit(3);

        const parts = (partsData || []).map((row) => mapPartsRow(row, vehiclesWithHistory));

        let timeline = [];
        if (jobsData?.length) {
          const latestJob = jobsData[0];
          const response = await fetch(`/api/status/getHistory?jobId=${encodeURIComponent(latestJob.job_number)}`);
          const payload = await response.json();
          if (response.ok && payload?.history) {
            timeline = mapTimeline(payload.history);
          }
        }

        if (cancelled) return;
        setState({
          isLoading: false,
          error: null,
          customer: customerRow,
          vehicles: vehiclesWithHistory,
          jobs: jobsData || [],
          vhcSummaries,
          parts,
          timeline,
          contacts: buildContacts(usersByRole),
        });
      } catch (error) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "Unable to load customer data",
        }));
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, usersByRole]);

  const contacts = useMemo(() => buildContacts(usersByRole), [usersByRole]);

  return { ...state, contacts };
}
