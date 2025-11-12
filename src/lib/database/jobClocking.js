import { getDatabaseClient } from "@/lib/database/client";

const db = getDatabaseClient();
const TABLE_NAME = "job_clocking";
const JOB_TABLE = "jobs";

const CLOCKING_COLUMNS = [
  "id",
  "user_id",
  "job_id",
  "job_number",
  "clock_in",
  "clock_out",
  "work_type",
  "created_at",
  "updated_at",
].join(", ");

export const JOB_COLUMNS = `
  id,
  job_number,
  status,
  vehicle_reg,
  vehicle_make_model,
  customer_firstname:customer_id(firstname),
  customer_lastname:customer_id(lastname),
  customer:customer_id(
    firstname,
    lastname
  ),
  vehicle:vehicle_id(
    registration,
    reg_number,
    make,
    model,
    make_model
  )
`;

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const coerceInteger = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || Number.isNaN(numeric)) {
    return null;
  }
  return Number.isInteger(numeric) ? numeric : null;
};

const assertInteger = (value, fieldName) => {
  const numeric = coerceInteger(value);
  if (numeric === null) {
    throw new Error(`${fieldName} must be an integer.`);
  }
  return numeric;
};

const normaliseJobNumber = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  const text = typeof value === "string" ? value : String(value);
  return text.trim();
};

const normaliseWorkType = (value) => {
  if (typeof value !== "string") {
    return "initial";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "initial";
  }
  const lower = trimmed.toLowerCase();
  if (lower === "initial" || lower === "additional") {
    return lower;
  }
  return trimmed;
};

const calculateHoursWorked = (clockIn, clockOut) => {
  if (!clockIn) {
    return 0;
  }
  const start = Date.parse(clockIn);
  const end = clockOut ? Date.parse(clockOut) : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0;
  }
  const hours = (end - start) / (1000 * 60 * 60);
  return Number(hours.toFixed(2));
};

const formatCustomerName = (customer = {}) => {
  const first =
    customer.customer_firstname ??
    customer.firstname ??
    (typeof customer.first_name === "string" ? customer.first_name : "");
  const last =
    customer.customer_lastname ??
    customer.lastname ??
    (typeof customer.last_name === "string" ? customer.last_name : "");
  return `${first} ${last}`.trim();
};

const deriveJobMeta = (job = {}) => {
  const reg =
    job.vehicle_reg ||
    job.vehicle?.registration ||
    job.vehicle?.reg_number ||
    "";
  const makeModel =
    job.vehicle_make_model ||
    job.vehicle?.make_model ||
    [job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ").trim();
  const aliasCustomer =
    job.customer_firstname || job.customer_lastname
      ? {
          customer_firstname: job.customer_firstname,
          customer_lastname: job.customer_lastname,
        }
      : null;
  const customerName =
    formatCustomerName(aliasCustomer || job.customer) ||
    formatCustomerName(job.vehicle?.customer) ||
    "";

  return {
    reg,
    makeModel,
    customer: customerName,
    status: job.status ?? null,
  };
};

const mapClockingRow = (row = {}, job = null) => {
  const jobMeta = job ? deriveJobMeta(job) : { reg: "", makeModel: "", customer: "", status: null };
  return {
    clockingId: row.id ?? null,
    id: row.id ?? null,
    userId: row.user_id ?? null,
    jobId: row.job_id ?? null,
    jobNumber: row.job_number || job?.job_number || "",
    clockIn: row.clock_in || null,
    clockOut: row.clock_out || null,
    workType: row.work_type || "initial",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    hoursWorked: calculateHoursWorked(row.clock_in, row.clock_out),
    ...jobMeta,
  };
};

const fetchJobsByIds = async (jobIds = []) => {
  if (!Array.isArray(jobIds) || jobIds.length === 0) {
    return new Map();
  }

  const ids = [
    ...new Set(
      jobIds
        .map((id) => coerceInteger(id))
        .filter((id) => id !== null)
    ),
  ];

  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } = await db.from(JOB_TABLE).select(JOB_COLUMNS).in("id", ids);

  if (error) {
    console.error("Failed to fetch job metadata:", error.message);
    return new Map();
  }

  const mapping = new Map();
  (data || []).forEach((job) => {
    if (job?.id !== undefined && job?.id !== null) {
      mapping.set(job.id, job);
    }
  });
  return mapping;
};

const normaliseClockInArgs = (args) => {
  if (args.length === 1 && isPlainObject(args[0])) {
    return args[0];
  }
  if (args.length >= 3) {
    return {
      userId: args[0],
      jobId: args[1],
      jobNumber: args[2],
      workType: args[3],
    };
  }
  throw new Error("clockInToJob requires userId, jobId, and jobNumber.");
};

const normaliseClockOutArgs = (args) => {
  if (args.length === 1 && isPlainObject(args[0])) {
    const { clockingId, id, userId = null, jobId = null } = args[0];
    return { userId, jobId, clockingId: clockingId ?? id };
  }
  if (args.length === 1) {
    return { userId: null, jobId: null, clockingId: args[0] };
  }
  if (args.length === 2) {
    return { userId: args[0], jobId: null, clockingId: args[1] };
  }
  if (args.length >= 3) {
    return { userId: args[0], jobId: args[1], clockingId: args[2] };
  }
  throw new Error("clockOutFromJob requires a clockingId.");
};

const normaliseSwitchArgs = (args) => {
  if (args.length === 1 && isPlainObject(args[0])) {
    return args[0];
  }
  if (args.length >= 4) {
    return {
      userId: args[0],
      currentJobId: args[1],
      newJobId: args[2],
      newJobNumber: args[3],
      workType: args[4],
    };
  }
  throw new Error("switchJob requires userId, currentJobId, newJobId, and newJobNumber.");
};

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
};

export const clockInToJob = async (...rawArgs) => {
  try {
    const { userId, jobId, jobNumber, workType } = normaliseClockInArgs(rawArgs);
    const userIdInt = assertInteger(userId, "userId");
    const jobIdInt = assertInteger(jobId, "jobId");
    const jobNumberText = normaliseJobNumber(jobNumber);

    if (!jobNumberText) {
      throw new Error("clockInToJob requires a jobNumber string.");
    }

    const payload = {
      user_id: userIdInt,
      job_id: jobIdInt,
      job_number: jobNumberText,
      work_type: normaliseWorkType(workType),
      clock_in: new Date().toISOString(),
      clock_out: null,
    };

    const { data, error } = await db
      .from(TABLE_NAME)
      .insert([payload])
      .select(CLOCKING_COLUMNS)
      .single();

    if (error) {
      throw new Error(`Failed to clock in to job ${jobNumberText}: ${error.message}`);
    }

    const jobsById = await fetchJobsByIds([jobIdInt]);
    const mapped = mapClockingRow(data, jobsById.get(jobIdInt));
    return { success: true, data: mapped };
  } catch (err) {
    console.error("clockInToJob error:", err.message);
    return { success: false, error: err.message };
  }
};

export const clockOutFromJob = async (...rawArgs) => {
  try {
    const { userId, jobId, clockingId } = normaliseClockOutArgs(rawArgs);
    const clockingIdInt = assertInteger(clockingId, "clockingId");
    const userIdInt = userId !== null && userId !== undefined ? assertInteger(userId, "userId") : null;
    const jobIdInt = jobId !== null && jobId !== undefined ? assertInteger(jobId, "jobId") : null;
    const timestamp = new Date().toISOString();

    let query = db
      .from(TABLE_NAME)
      .update({ clock_out: timestamp, updated_at: timestamp })
      .eq("id", clockingIdInt);

    if (userIdInt !== null) {
      query = query.eq("user_id", userIdInt);
    }

    if (jobIdInt !== null) {
      query = query.eq("job_id", jobIdInt);
    }

    const { data, error } = await query.select(CLOCKING_COLUMNS).single();

    if (error) {
      throw new Error(`Failed to clock out entry ${clockingIdInt}: ${error.message}`);
    }

    const jobsById = await fetchJobsByIds([data.job_id]);
    const mapped = mapClockingRow(data, jobsById.get(data.job_id));
    return { success: true, data: mapped, hoursWorked: mapped.hoursWorked };
  } catch (err) {
    console.error("clockOutFromJob error:", err.message);
    return { success: false, error: err.message };
  }
};

export const getUserActiveJobs = async (rawUserId) => {
  try {
    const userId = assertInteger(rawUserId, "userId");

    const { data, error } = await db
      .from(TABLE_NAME)
      .select(CLOCKING_COLUMNS)
      .eq("user_id", userId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false });

    if (error) {
      throw new Error(`Failed to load active jobs for user ${userId}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return { success: true, data: [] };
    }

    const jobsById = await fetchJobsByIds(data.map((row) => row.job_id));
    const mapped = data.map((row) => mapClockingRow(row, jobsById.get(row.job_id)));
    return { success: true, data: mapped };
  } catch (err) {
    console.error("getUserActiveJobs error:", err.message);
    return { success: false, error: err.message, data: [] };
  }
};

export const getJobClockingEntries = async (jobId) => {
  const jobIdInt = assertInteger(jobId, "jobId");
  const { data, error } = await db
    .from(TABLE_NAME)
    .select(CLOCKING_COLUMNS)
    .eq("job_id", jobIdInt)
    .order("clock_in", { ascending: true });

  if (error) {
    throw new Error(`Failed to load clocking entries for job ${jobIdInt}: ${error.message}`);
  }

  const jobsById = await fetchJobsByIds([jobIdInt]);
  return (data || []).map((row) => mapClockingRow(row, jobsById.get(jobIdInt)));
};

export const deleteClockingEntry = async (clockingId) => {
  const clockingIdInt = assertInteger(clockingId, "clockingId");
  const { error } = await db.from(TABLE_NAME).delete().eq("id", clockingIdInt);
  if (error) {
    throw new Error(`Failed to delete clocking entry ${clockingIdInt}: ${error.message}`);
  }
  return { success: true, deletedId: clockingIdInt };
};

export const getTechnicianDailySummary = async (rawUserId) => {
  try {
    const userId = assertInteger(rawUserId, "userId");
    const { start, end } = getTodayRange();

    const { data, error } = await db
      .from(TABLE_NAME)
      .select(CLOCKING_COLUMNS)
      .eq("user_id", userId)
      .gte("clock_in", start)
      .lte("clock_in", end);

    if (error) {
      throw new Error(`Failed to load technician summary: ${error.message}`);
    }

    const rows = data || [];
    const totalHours = rows.reduce(
      (sum, row) => sum + calculateHoursWorked(row.clock_in, row.clock_out),
      0
    );

    return {
      success: true,
      data: {
        totalHours: Number(totalHours.toFixed(2)),
        activeJobs: rows.filter((row) => !row.clock_out).length,
        completedJobs: rows.filter((row) => row.clock_out).length,
      },
    };
  } catch (err) {
    console.error("getTechnicianDailySummary error:", err.message);
    return { success: false, error: err.message };
  }
};

export const switchJob = async (...rawArgs) => {
  try {
    const { userId, currentJobId, newJobId, newJobNumber, workType } = normaliseSwitchArgs(rawArgs);
    const userIdInt = assertInteger(userId, "userId");
    const currentJobIdInt = assertInteger(currentJobId, "currentJobId");
    const newJobIdInt = assertInteger(newJobId, "newJobId");
    const newJobNumberText = normaliseJobNumber(newJobNumber);

    if (!newJobNumberText) {
      throw new Error("switchJob requires a newJobNumber string.");
    }

    const { data: activeRow, error: activeError } = await db
      .from(TABLE_NAME)
      .select("id")
      .eq("user_id", userIdInt)
      .eq("job_id", currentJobIdInt)
      .is("clock_out", null)
      .maybeSingle();

    if (activeError && activeError.code !== "PGRST116") {
      throw new Error(`Failed to find active job ${currentJobIdInt}: ${activeError.message}`);
    }

    if (!activeRow) {
      throw new Error(`No active job ${currentJobIdInt} found to switch from.`);
    }

    const clockOutResult = await clockOutFromJob({
      userId: userIdInt,
      jobId: currentJobIdInt,
      clockingId: activeRow.id,
    });

    if (!clockOutResult.success) {
      return clockOutResult;
    }

    const clockInResult = await clockInToJob({
      userId: userIdInt,
      jobId: newJobIdInt,
      jobNumber: newJobNumberText,
      workType,
    });

    if (!clockInResult.success) {
      return clockInResult;
    }

    return {
      success: true,
      previous: clockOutResult.data,
      current: clockInResult.data,
      hoursWorked: clockOutResult.hoursWorked,
    };
  } catch (err) {
    console.error("switchJob error:", err.message);
    return { success: false, error: err.message };
  }
};
