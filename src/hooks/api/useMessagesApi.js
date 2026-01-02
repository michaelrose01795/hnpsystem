// file location: src/hooks/api/useMessagesApi.js
import { useMemo } from "react";
import {
  addThreadMembers,
  connectCustomerToThread,
  createThread,
  fetchMessageDirectory,
  fetchMessageThreads,
  fetchSystemNotifications,
  fetchThreadMessages,
  removeThreadMembers,
  saveMessage,
  sendThreadMessage,
  updateThread,
  deleteThread,
} from "@/lib/api/messages";

export const useMessagesApi = () =>
  useMemo(
    () => ({
      listThreads: fetchMessageThreads,
      listThreadMessages: fetchThreadMessages,
      listDirectoryUsers: fetchMessageDirectory,
      createThread,
      sendMessage: sendThreadMessage,
      listSystemNotifications: fetchSystemNotifications,
      addMembers: addThreadMembers,
      removeMembers: removeThreadMembers,
      saveMessage,
      updateThread,
      deleteThread,
      connectCustomer: connectCustomerToThread,
    }),
    []
  );

export default useMessagesApi;
