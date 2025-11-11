// file location: src/context/NextActionContext.js
"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react"; // import React helpers

// Map each action type to the instructional content we want to show
const ACTION_LIBRARY = {
  vhc_complete: {
    title: "Vehicle Health Check Complete",
    instruction:
      "Great work! Hang the keys in the Completed hooks and make sure the bay allocation is logged.",
    defaultKeyAction: "Keys hung in completed section",
    defaultVehicleStatus: "Ready For Collection",
  },
  job_complete: {
    title: "Job Marked Complete",
    instruction:
      "Please hang the keys on the Completed board and capture where the vehicle is parked for collection.",
    defaultKeyAction: "Keys hung for completed job",
    defaultVehicleStatus: "Ready For Collection",
  },
  job_checked_in: {
    title: "Vehicle Checked In",
    instruction:
      "Hang the keys on the Jobs In hooks and set the initial parking location so the workshop can find the vehicle.",
    defaultKeyAction: "Keys stored in jobs-in section",
    defaultVehicleStatus: "Awaiting Workshop",
  },
};

// Helper to compose a clean display object using payload data
const buildActionPayload = (actionType, payload = {}) => {
  const config = ACTION_LIBRARY[actionType];
  if (!config) return null; // ignore unknown action types

  const {
    jobId = null,
    jobNumber = "",
    vehicleId = null,
    vehicleReg = "",
    triggeredBy = null,
  } = payload;

  return {
    actionType,
    jobId,
    jobNumber,
    vehicleId,
    vehicleReg,
    triggeredBy,
    title: config.title,
    instruction: config.instruction,
    defaultKeyAction: config.defaultKeyAction,
    defaultVehicleStatus: config.defaultVehicleStatus,
  };
};

const NextActionContext = createContext(null); // create context container

export const NextActionProvider = ({ children }) => {
  const [nextAction, setNextAction] = useState(null); // store the active action

  const triggerNextAction = useCallback((actionType, payload = {}) => {
    const action = buildActionPayload(actionType, payload);
    if (!action) return; // do nothing if unsupported action
    setNextAction({ ...action, opened: false, triggeredAt: Date.now() });
  }, []);

  const clearNextAction = useCallback(() => {
    setNextAction(null);
  }, []);

  const markOpened = useCallback(() => {
    setNextAction((prev) => (prev ? { ...prev, opened: true } : prev));
  }, []);

  const value = useMemo(
    () => ({
      nextAction,
      triggerNextAction,
      clearNextAction,
      markOpened,
    }),
    [nextAction, triggerNextAction, clearNextAction, markOpened]
  );

  return <NextActionContext.Provider value={value}>{children}</NextActionContext.Provider>;
};

export const useNextAction = () => {
  const context = useContext(NextActionContext);
  if (!context) {
    throw new Error("useNextAction must be used within a NextActionProvider");
  }
  return context;
};
