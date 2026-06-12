// file location: src/components/page-ui/job-cards/contact/ContactTab.js
// Redesigned job-card Contact tab — a customer-relationship hub with four sections:
//   1. Customer Contact  (details + map links + call/text/email/WhatsApp actions)
//   2. Notes & Preferences (quick toggles + multiselect + customer notes)
//   3. Communication History (in-app thread messages as a tracking tree)
//   4. Quick Message Templates (send templated messages into the in-app thread)
//
// This is the default export consumed by the job-card presentation layer
// (src/components/page-ui/job-cards/job-cards-job-number-ui.js). It owns the
// in-app messaging thread state and the templates list; the contact/preferences
// persistence flows through the shared onSaveCustomerDetails handler.
import React, { useCallback, useEffect, useState } from "react";
import {
  ensureJobCustomerThread,
  fetchThreadMessages,
  sendThreadMessage,
  fetchMessageTemplates,
} from "@/lib/api/messages";
import CustomerContactSection from "./CustomerContactSection";
import CustomerPreferencesSection from "./CustomerPreferencesSection";
import CommunicationHistorySection from "./CommunicationHistorySection";
import QuickMessageTemplatesSection from "./QuickMessageTemplatesSection";

export default function ContactTab({
  jobData,
  canEdit,
  onSaveCustomerDetails,
  customerSaving,
  dbUserId,
}) {
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sending, setSending] = useState(false);

  const jobNumber = jobData?.jobNumber || "";
  const jobId = jobData?.id || null;
  const customerEmail = jobData?.customerEmail || "";
  const customerName = jobData?.customer || "";
  const canMessage = Boolean(customerEmail && dbUserId);

  // ---- communication history (in-app thread) ----
  const loadHistory = useCallback(async () => {
    if (!canMessage || !jobNumber) return;
    setLoadingHistory(true);
    try {
      const threadPayload = await ensureJobCustomerThread({
        jobId,
        jobNumber,
        actorId: dbUserId,
        customerEmail,
        customerName,
      });
      const nextThread = threadPayload?.thread || threadPayload?.data || null;
      setThread(nextThread);
      if (nextThread?.id) {
        const messagesPayload = await fetchThreadMessages(nextThread.id, {
          userId: dbUserId,
          limit: 80,
        });
        setMessages(messagesPayload?.data || messagesPayload?.messages || []);
      }
    } catch (error) {
      console.error("ContactTab: failed to load communication history:", error);
    } finally {
      setLoadingHistory(false);
    }
  }, [canMessage, jobNumber, jobId, dbUserId, customerEmail, customerName]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ---- templates ----
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const payload = await fetchMessageTemplates();
      setTemplates(payload?.templates || []);
    } catch (error) {
      console.error("ContactTab: failed to load templates:", error);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ---- send a templated message into the in-app thread ----
  const handleSend = useCallback(
    async ({ content, templateKey, templateTitle }) => {
      if (!canMessage || !content) return;
      setSending(true);
      try {
        let activeThread = thread;
        if (!activeThread?.id) {
          const threadPayload = await ensureJobCustomerThread({
            jobId,
            jobNumber,
            actorId: dbUserId,
            customerEmail,
            customerName,
          });
          activeThread = threadPayload?.thread || threadPayload?.data || null;
          setThread(activeThread);
        }
        if (!activeThread?.id) throw new Error("No conversation thread available.");

        await sendThreadMessage(activeThread.id, {
          senderId: dbUserId,
          content,
          metadata: {
            audience: "customer",
            customerVisible: true,
            jobNumber,
            channel: "in-app",
            templateKey,
            templateTitle,
          },
        });
        await loadHistory();
      } catch (error) {
        console.error("ContactTab: failed to send message:", error);
        // Surface minimally — the confirm dialog already closed; a failed send
        // simply won't appear in the history (which reloads on success).
        alert(error?.message || "Failed to send message.");
      } finally {
        setSending(false);
      }
    },
    [canMessage, thread, jobId, jobNumber, dbUserId, customerEmail, customerName, loadHistory]
  );

  const templateVars = {
    customerName: jobData?.customerFirstName || customerName || "there",
    jobNumber,
    reg: jobData?.reg || "",
  };

  return (
    <>
      <CustomerContactSection
        jobData={jobData}
        canEdit={canEdit}
        onSaveCustomerDetails={onSaveCustomerDetails}
        customerSaving={customerSaving}
      />
      <CustomerPreferencesSection
        jobData={jobData}
        canEdit={canEdit}
        onSaveCustomerDetails={onSaveCustomerDetails}
        customerSaving={customerSaving}
      />
      <CommunicationHistorySection messages={messages} loading={loadingHistory} />
      <QuickMessageTemplatesSection
        templates={templates}
        loading={loadingTemplates}
        vars={templateVars}
        customerName={customerName || "the customer"}
        canSend={canEdit && canMessage}
        sending={sending}
        onSend={handleSend}
        onReloadTemplates={loadTemplates}
        updatedBy={dbUserId}
      />
    </>
  );
}
