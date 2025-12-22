// file location: src/hooks/api/useJobcardsApi.js
import { useMemo } from "react";
import {
  assignJobTechnician,
  createJobcard,
  fetchJobcardDetails,
  fetchJobcards,
  unassignJobTechnician,
  updateJobcard,
  updateJobWaitingPosition,
} from "@/lib/api/jobcards";

export const useJobcardsApi = () =>
  useMemo(
    () => ({
      listJobcards: fetchJobcards,
      getJobcard: fetchJobcardDetails,
      createJobcard,
      updateJobcard,
      assignTechnician: assignJobTechnician,
      unassignTechnician: unassignJobTechnician,
      updateJobPosition: updateJobWaitingPosition,
    }),
    []
  );

export default useJobcardsApi;
