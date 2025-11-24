// file location: src/lib/jobcards/jobDataTransformers.js

const normalizeRequests = (rawRequests) => {
  if (Array.isArray(rawRequests)) {
    return rawRequests;
  }

  if (typeof rawRequests === "string") {
    try {
      const parsed = JSON.parse(rawRequests);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  if (rawRequests && typeof rawRequests === "object") {
    return [];
  }

  return [];
};

const formatAppointmentRow = (appointmentRow) => {
  if (!appointmentRow) return null;

  const scheduledAt = appointmentRow.scheduled_time
    ? new Date(appointmentRow.scheduled_time)
    : null;
  const dateString = scheduledAt
    ? `${scheduledAt.getFullYear()}-${String(scheduledAt.getMonth() + 1).padStart(2, "0")}-${String(scheduledAt.getDate()).padStart(2, "0")}`
    : "";
  const timeString = scheduledAt
    ? scheduledAt.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      })
    : "";

  return {
    appointmentId: appointmentRow.appointment_id,
    date: dateString,
    time: timeString,
    status: appointmentRow.status || "",
    notes: appointmentRow.notes || "",
    createdAt: appointmentRow.created_at || null,
    updatedAt: appointmentRow.updated_at || null
  };
};

const mapNotesWithUsers = (rows = []) => {
  const sorted = [...(rows || [])].sort((a, b) => {
    const aDate = a?.updated_at || a?.created_at;
    const bDate = b?.updated_at || b?.created_at;
    const aTime = aDate ? new Date(aDate).getTime() : 0;
    const bTime = bDate ? new Date(bDate).getTime() : 0;
    return bTime - aTime;
  });

  return sorted.map((note) => {
    const userName = note.user
      ? `${note.user.first_name || ""} ${note.user.last_name || ""}`.trim() ||
        note.user.email ||
        "Unknown"
      : "Unknown";

    return {
      noteId: note.note_id,
      jobId: note.job_id,
      userId: note.user_id,
      noteText: note.note_text,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
      createdBy: userName,
      createdByEmail: note.user?.email || "",
      createdByRole: note.user?.role || ""
    };
  });
};

const mapJobRequests = (jobRow) => {
  const requestRows = Array.isArray(jobRow?.job_requests) ? jobRow.job_requests : [];
  if (requestRows.length > 0) {
    return requestRows
      .slice()
      .sort((a, b) => (a?.sort_order || 0) - (b?.sort_order || 0))
      .map((req) => ({
        requestId: req.request_id,
        text: req.description || "",
        time: req.hours ?? "",
        paymentType: req.job_type || "Customer"
      }));
  }

  return normalizeRequests(jobRow?.requests);
};

const mapPartsRequests = (rows = []) =>
  (rows || []).map((req) => ({
    requestId: req.request_id,
    quantity: req.quantity ?? null,
    status: req.status || "",
    description: req.description || "",
    part: req.part
      ? {
          id: req.part.id,
          partNumber: req.part.part_number,
          name: req.part.name,
          description: req.part.description,
          unitCost: req.part.unit_cost,
          unitPrice: req.part.unit_price,
          qtyInStock: req.part.qty_in_stock,
          qtyReserved: req.part.qty_reserved,
          qtyOnOrder: req.part.qty_on_order,
          storageLocation: req.part.storage_location
        }
      : null,
    requestedBy: req.requester
      ? `${req.requester.first_name || ""} ${req.requester.last_name || ""}`.trim()
      : "",
    approvedBy: req.approver
      ? `${req.approver.first_name || ""} ${req.approver.last_name || ""}`.trim()
      : "",
    createdAt: req.created_at || null,
    updatedAt: req.updated_at || null
  }));

const mapPartsAllocations = (rows = []) =>
  (rows || []).map((item) => ({
    id: item.id,
    partId: item.part_id,
    quantityRequested: item.quantity_requested ?? 0,
    quantityAllocated: item.quantity_allocated ?? 0,
    quantityFitted: item.quantity_fitted ?? 0,
    status: item.status || "pending",
    origin: item.origin || null,
    prePickLocation: item.pre_pick_location || null,
    storageLocation: item.storage_location || item.part?.storage_location || null,
    unitCost: item.unit_cost ?? item.part?.unit_cost ?? 0,
    unitPrice: item.unit_price ?? item.part?.unit_price ?? 0,
    requestNotes: item.request_notes || "",
    allocatedBy: item.allocated_by || null,
    pickedBy: item.picked_by || null,
    fittedBy: item.fitted_by || null,
    createdAt: item.created_at || null,
    updatedAt: item.updated_at || null,
    part: item.part
      ? {
          id: item.part.id,
          partNumber: item.part.part_number,
          name: item.part.name,
          description: item.part.description,
          unitCost: item.part.unit_cost,
          unitPrice: item.part.unit_price,
          qtyInStock: item.part.qty_in_stock,
          qtyReserved: item.part.qty_reserved,
          qtyOnOrder: item.part.qty_on_order,
          storageLocation: item.part.storage_location
        }
      : null
  }));

const mapClockingStatus = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const active = rows.find((entry) => !entry.clock_out) || rows[0];
  if (!active) return null;

  const userName = active.user
    ? `${active.user.first_name || ""} ${active.user.last_name || ""}`.trim() ||
      active.user.email ||
      ""
    : "";

  return {
    clockingId: active.id,
    userId: active.user_id,
    userName,
    clockIn: active.clock_in,
    clockOut: active.clock_out,
    workType: active.work_type || "initial",
    createdAt: active.created_at,
    updatedAt: active.updated_at
  };
};

const mapWarrantyJob = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const job = rows[0];
  if (!job) return null;

  return {
    id: job.id,
    jobNumber: job.job_number,
    status: job.status,
    jobSource: job.job_source,
    vehicleReg: job.vehicle_reg,
    vehicleMakeModel: job.vehicle_make_model,
    createdAt: job.created_at
  };
};

const mapServiceHistoryJobs = (rows = []) =>
  (rows || [])
    .filter(Boolean)
    .map((row) => {
      const requests = mapJobRequests(row);
      const invoiceFile = (row.job_files || []).find((file) => {
        const type = file?.file_type?.toLowerCase() || "";
        const folder = file?.folder?.toLowerCase() || "";
        return type.includes("invoice") || folder.includes("invoice");
      });

      const serviceDateRaw =
        row.appointments?.[0]?.scheduled_time || row.created_at || null;
      const serviceDateFormatted = serviceDateRaw
        ? new Date(serviceDateRaw).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
          })
        : "Unknown";

      return {
        id: row.id,
        jobNumber: row.job_number,
        serviceDate: serviceDateRaw,
        serviceDateFormatted,
        mileage: row.mileage_at_service ?? null,
        requests,
        invoiceUrl: invoiceFile?.file_url || "",
        invoiceName: invoiceFile?.file_name || "",
        invoiceAvailable: Boolean(invoiceFile)
      };
    });

const buildJobDataFromRow = (row, extras = {}) => {
  if (!row) return null;

  const appointment = formatAppointmentRow(row.appointments?.[0]);
  const vehicle = row.vehicle || {};
  const customer = vehicle.customer || row.customer_record || {};

  return {
    id: row.id,
    jobNumber: row.job_number,
    description: row.description || "",
    type: row.type || "",
    status: row.status || "",
    reg: row.vehicle_reg || vehicle.registration || vehicle.reg_number || "",
    make: vehicle.make || "",
    model: vehicle.model || "",
    makeModel: row.vehicle_make_model || vehicle.make_model || "",
    year: vehicle.year || "",
    colour: vehicle.colour || "",
    vin: vehicle.vin || "",
    chassis: vehicle.chassis || "",
    engineNumber: vehicle.engine_number || "",
    engine: vehicle.engine || "",
    mileage: vehicle.mileage || "",
    fuelType: vehicle.fuel_type || "",
    transmission: vehicle.transmission || "",
    bodyStyle: vehicle.body_style || "",
    motDue: vehicle.mot_due || "",
    waitingStatus: row.waiting_status || "Neither",
    jobSource: row.job_source || "Retail",
    jobCategories: row.job_categories || [],
    requests: mapJobRequests(row),
    cosmeticNotes: row.job_cosmetic_damage?.[0]?.notes || row.cosmetic_notes || "",
    cosmeticDamagePresent: row.job_cosmetic_damage?.[0]?.has_damage ?? null,
    vhcRequired: Boolean(row.vhc_required),
    maintenanceInfo: row.maintenance_info || {},
    technician: "",
    technicianEmail: "",
    technicianRole: "",
    assignedTo: row.assigned_to,
    customer: customer.firstname || customer.lastname
      ? `${customer.firstname || ""} ${customer.lastname || ""}`.trim()
      : "",
    customerFirstName: customer.firstname || "",
    customerLastName: customer.lastname || "",
    customerMobile: customer.mobile || "",
    customerTelephone: customer.telephone || "",
    customerId: row.customer_id || customer.id || null,
    customerPhone: customer.mobile || customer.telephone || "",
    customerEmail: customer.email || "",
    customerAddress: customer.address || "",
    customerPostcode: customer.postcode || "",
    customerContactPreference: customer.contact_preference || "Email",
    appointment,
    vhcChecks: Array.isArray(row.vhc_checks) ? row.vhc_checks : [],
    partsRequests: mapPartsRequests(row.parts_requests),
    partsAllocations: mapPartsAllocations(row.parts_job_items),
    notes: mapNotesWithUsers(row.job_notes || []),
    writeUp: row.job_writeups?.[0] || null,
    writeUpStatus:
      row.job_writeups?.[0]?.completion_status || row.completion_status || "",
    clockingStatus: extras.clockingStatus || null,
    warrantyJob: extras.warrantyJob || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

export {
  normalizeRequests,
  formatAppointmentRow,
  mapNotesWithUsers,
  mapJobRequests,
  mapPartsRequests,
  mapPartsAllocations,
  mapClockingStatus,
  mapWarrantyJob,
  mapServiceHistoryJobs,
  buildJobDataFromRow
};

export default buildJobDataFromRow;
