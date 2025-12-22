// file location: src/lib/api/jobcards.js
import { apiRequest } from "@/lib/api/client";

const encodeJobNumber = (jobNumber) => {
  if (!jobNumber) {
    throw new Error("Job number is required");
  }
  return encodeURIComponent(String(jobNumber).trim());
};

export const fetchJobcards = async (filters = {}) => {
  return apiRequest("/api/jobcards", { searchParams: filters });
};

export const fetchJobcardDetails = async (jobNumber) => {
  return apiRequest(`/api/jobcards/${encodeJobNumber(jobNumber)}`);
};

export const updateJobcard = async (jobNumber, updates) => {
  return apiRequest(`/api/jobcards/${encodeJobNumber(jobNumber)}`, {
    method: "PUT",
    body: updates,
  });
};

export const createJobcard = async (payload) => {
  if (!payload) {
    throw new Error("Job card payload is required");
  }
  return apiRequest("/api/jobcards", {
    method: "POST",
    body: payload,
  });
};

export const deleteJobcardFile = async (fileId) => {
  if (!fileId) {
    throw new Error("File id is required");
  }
  return apiRequest(`/api/jobcards/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });
};

export const fetchJobcardNotes = async (jobNumber) => {
  return apiRequest(`/api/jobcards/${encodeJobNumber(jobNumber)}/notes`);
};

export const createJobcardNote = async (jobNumber, payload) => {
  return apiRequest(`/api/jobcards/${encodeJobNumber(jobNumber)}/notes`, {
    method: "POST",
    body: payload,
  });
};

export const updateJobcardNote = async (jobNumber, noteId, payload) => {
  return apiRequest(
    `/api/jobcards/${encodeJobNumber(jobNumber)}/notes/${encodeURIComponent(
      noteId
    )}`,
    {
      method: "PUT",
      body: payload,
    }
  );
};

export const deleteJobcardNote = async (jobNumber, noteId) => {
  return apiRequest(
    `/api/jobcards/${encodeJobNumber(jobNumber)}/notes/${encodeURIComponent(
      noteId
    )}`,
    {
      method: "DELETE",
    }
  );
};

export const fetchWarrantyOptions = async (jobNumber) => {
  return apiRequest(
    `/api/jobcards/${encodeJobNumber(jobNumber)}/warranty-options`
  );
};

export const linkWarrantyJob = async (
  jobNumber,
  payload = { targetJobNumber: null }
) => {
  return apiRequest(
    `/api/jobcards/${encodeJobNumber(jobNumber)}/warranty-link`,
    {
      method: "POST",
      body: payload,
    }
  );
};

export const fetchJobcardWriteUp = async (jobNumber) => {
  return apiRequest(`/api/jobcards/${encodeJobNumber(jobNumber)}/write-up`);
};

export const saveJobcardWriteUp = async (jobNumber, writeUp) => {
  if (!writeUp || typeof writeUp !== "object") {
    throw new Error("Write-up payload is required");
  }
  return apiRequest(`/api/jobcards/${encodeJobNumber(jobNumber)}/write-up`, {
    method: "PUT",
    body: { writeUp },
  });
};

export const saveJobcardWriteUpSnapshot = async (
  jobNumber,
  payload = {}
) => {
  return apiRequest(
    `/api/jobcards/${encodeJobNumber(jobNumber)}/write-up/live`,
    {
      method: "PUT",
      body: payload,
    }
  );
};

export const fetchJobcardAuthorizedWork = async (jobNumber) => {
  return apiRequest(
    `/api/jobcards/${encodeJobNumber(jobNumber)}/authorized-work`
  );
};

export const assignJobTechnician = async (jobNumber, payload) => {
  if (!payload) {
    throw new Error("Technician assignment payload is required");
  }
  return apiRequest(`/api/jobcards/${encodeJobNumber(jobNumber)}/assignment`, {
    method: "POST",
    body: payload,
  });
};

export const unassignJobTechnician = async (jobNumber) => {
  return apiRequest(`/api/jobcards/${encodeJobNumber(jobNumber)}/assignment`, {
    method: "DELETE",
  });
};

export const updateJobWaitingPosition = async (jobNumber, payload) => {
  if (!payload) {
    throw new Error("Position update payload is required");
  }
  return apiRequest(`/api/jobcards/${encodeJobNumber(jobNumber)}/position`, {
    method: "PUT",
    body: payload,
  });
};
