// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/api/hr/employees.js
import { getEmployeeDirectory } from "@/lib/database/hr";
import { supabaseService } from "@/lib/supabaseClient";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return handleDirectoryRequest(res);
  }

  if (req.method === "POST") {
    return handleCreateOrUpdate(req, res);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

async function handleDirectoryRequest(res) {
  try {
    const data = await getEmployeeDirectory();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ /api/hr/employees error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load employee directory",
      error: error.message,
    });
  }
}

const REQUIRED_FIELDS = ["email", "firstName", "lastName"];

const numericFields = new Set([
  "contractedHours",
  "hourlyRate",
  "overtimeRate",
  "annualSalary",
]);

const dateFields = new Set(["startDate", "probationEnd"]);

function sanitizePayload(body = {}) {
  const normalized = {};
  Object.entries(body).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === "string") {
      normalized[key] = value.trim();
      return;
    }
    normalized[key] = value;
  });
  return normalized;
}

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toIsoDate = (value) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = value.split(/[\/\-]/).map((part) => part.trim());
  if (parts.length !== 3) return null;
  if (parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
  }
  const [day, month, yearRaw] = parts;
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

async function handleCreateOrUpdate(req, res) {
  if (!supabaseService) {
    return res
      .status(500)
      .json({ success: false, message: "Server missing Supabase service client" });
  }

  const payload = sanitizePayload(req.body);

  for (const field of REQUIRED_FIELDS) {
    if (!payload[field]) {
      return res
        .status(400)
        .json({ success: false, message: `Missing required field ${field}` });
    }
  }

  const email = payload.email.toLowerCase();
  const firstName = payload.firstName;
  const lastName = payload.lastName;
  const role = payload.role || "EMPLOYEE";

  try {
    const userRecord = await upsertUser({
      email,
      firstName,
      lastName,
      phone: payload.phone || null,
      role,
      jobTitle: payload.jobTitle,
      payload,
    });

    const directory = await getEmployeeDirectory();
    const employeeFromDirectory =
      directory.find(
        (entry) => entry.userId === userRecord.user_id || entry.email?.toLowerCase() === email
      ) ?? null;

    const fallbackEmployee = employeeFromDirectory || {
      id: `EMP-${userRecord.user_id}`,
      userId: userRecord.user_id,
      name: `${firstName} ${lastName}`.trim(),
      jobTitle: payload.jobTitle || userRecord.job_title || role,
      department: payload.department || "Unassigned",
      role,
      employmentType: payload.employmentType || "Full-time",
      status: payload.status || "Active",
      startDate: payload.startDate || null,
      email,
      phone: payload.phone || "",
      keycloakId: payload.keycloakId || null,
    };

    return res.status(200).json({
      success: true,
      employee: fallbackEmployee,
    });
  } catch (error) {
    console.error("❌ Failed to create/update employee", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save employee",
      error: error.message,
    });
  }
}

async function upsertUser({ email, firstName, lastName, phone, role, jobTitle, payload }) {
  const { data: existingUser, error: lookupError } = await supabaseService
    .from("users")
    .select("user_id, email")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) throw lookupError;

  // Build the combined user + employee fields payload
  const buildEmployeeFields = () => {
    const ec = payload.emergencyContact;
    let emergencyContact = null;
    if (ec) {
      if (typeof ec === "string") emergencyContact = { raw: ec };
      else if (typeof ec === "object" && ec.raw) emergencyContact = ec;
      else if (typeof ec === "object" && ec.name) {
        const parts = [ec.name, ec.phone, ec.relationship].filter(Boolean);
        emergencyContact = parts.length > 0 ? { raw: parts.join(", ") } : null;
      } else {
        emergencyContact = { raw: String(ec) };
      }
    }

    return {
      department: payload.department || null,
      employment_type: payload.employmentType || null,
      employment_status: payload.status || null,
      start_date: toIsoDate(payload.startDate),
      manager_id: payload.managerId || null,
      emergency_contact: emergencyContact,
      contracted_hours: toNumberOrNull(payload.contractedHours),
      hourly_rate: toNumberOrNull(payload.hourlyRate),
      overtime_rate: toNumberOrNull(payload.overtimeRate),
      annual_salary: toNumberOrNull(payload.annualSalary),
      payroll_reference: payload.payrollNumber || null,
      national_insurance_number: payload.nationalInsurance || null,
      keycloak_user_id: payload.keycloakId || null,
      home_address: payload.address || null,
    };
  };

  const userPayload = {
    first_name: firstName,
    last_name: lastName,
    phone: phone || null,
    job_title: jobTitle || null,
    role,
    ...buildEmployeeFields(),
  };

  if (existingUser) {
    const { data, error } = await supabaseService
      .from("users")
      .update(userPayload)
      .eq("user_id", existingUser.user_id)
      .select("user_id, first_name, last_name, email, role, job_title")
      .maybeSingle();
    if (error) throw error;
    return data || existingUser;
  }

  const insertPayload = {
    ...userPayload,
    email,
    password_hash: "external_auth",
  };

  const { data, error } = await supabaseService
    .from("users")
    .insert(insertPayload)
    .select("user_id, first_name, last_name, email, role, job_title")
    .single();

  if (error) throw error;
  return data;
}
