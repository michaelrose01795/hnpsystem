import React, { useEffect, useMemo, useRef, useState } from "react";
import ModalPortal from "@/components/popups/ModalPortal";
import styles from "@/features/invoices/styles/invoice.module.css";
import {
  findPaymentFlowMethod,
  PAYMENT_FLOW_METHODS,
  PAYMENT_FLOW_OUTCOMES,
  PAYMENT_FLOW_STEPS,
} from "@/lib/payments/paymentFlow";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    Number(value || 0)
  );

const outcomeLabel = (value) => PAYMENT_FLOW_OUTCOMES[value]?.label || value;

const toneStyle = (tone) => {
  if (tone === "success") {
    return {
      background: "var(--success-surface)",
      color: "var(--success-dark)",
      borderColor: "var(--success)",
    };
  }
  if (tone === "danger") {
    return {
      background: "var(--danger-surface)",
      color: "var(--danger-dark)",
      borderColor: "var(--danger)",
    };
  }
  if (tone === "warning") {
    return {
      background: "var(--warning-surface)",
      color: "var(--warning-dark)",
      borderColor: "var(--warning)",
    };
  }
  return {
    background: "var(--info-surface)",
    color: "var(--info-dark)",
    borderColor: "var(--info)",
  };
};

const buildMethodSummary = ({ method, amount, amountReceived }) => {
  if (method.id === "cash") {
    const received = Number(amountReceived || 0);
    const total = Number(amount || 0);
    const change = received - total;
    return {
      title: "Cash desk handover",
      description:
        received >= total
          ? `Cash received ${formatCurrency(received)}. Change due ${formatCurrency(Math.max(change, 0))}.`
          : `Cash received ${formatCurrency(received)}. Additional cash is still required before release.`,
    };
  }

  if (method.id === "card") {
    return {
      title: "Card machine session",
      description: `Connect the reader, confirm ${formatCurrency(amount)}, then run a simulated terminal result.`,
    };
  }

  if (method.id === "klarna" || method.id === "bumper") {
    return {
      title: `${method.label} handoff`,
      description: `Start the provider journey for ${formatCurrency(amount)} and simulate approval, decline, or timeout.`,
    };
  }

  if (method.id === "phone") {
    return {
      title: "Over-the-phone capture",
      description:
        "Use this to document the MOTO flow. Real PCI-compliant backend capture is still a TODO and this remains simulated.",
    };
  }

  if (method.id === "balance") {
    return {
      title: "Customer portal settlement",
      description:
        "Publish the balance to the customer portal, then simulate portal confirmation or a follow-up requirement.",
    };
  }

  if (method.id === "email") {
    return {
      title: "Email dispatch",
      description: "Mark the invoice as sent to the customer's email without processing payment.",
    };
  }

  return {
    title: "Portal publication",
    description: "Publish the live invoice balance to the customer portal without settling it yet.",
  };
};

export default function InvoicePaymentModal({
  isOpen,
  onClose,
  invoice,
  customerEmail,
  onInvoiceActionComplete,
  onPaymentCompleted,
  onReleaseRequested,
}) {
  const invoiceTotal = Number(invoice?.totals?.invoice_total || 0);
  const [selectedMethodId, setSelectedMethodId] = useState("card");
  const [selectedOutcome, setSelectedOutcome] = useState("success");
  const [currentState, setCurrentState] = useState("");
  const [amount, setAmount] = useState(invoiceTotal);
  const [amountReceived, setAmountReceived] = useState(invoiceTotal);
  const [reference, setReference] = useState("");
  const [activityLog, setActivityLog] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [showReleasePrompt, setShowReleasePrompt] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const timeoutsRef = useRef([]);

  const selectedMethod = useMemo(
    () => findPaymentFlowMethod(selectedMethodId),
    [selectedMethodId]
  );
  const invoiceAlreadyPaid =
    invoice?.paid === true ||
    String(invoice?.payment_status || "").trim().toLowerCase() === "paid";

  const methodSummary = useMemo(
    () =>
      buildMethodSummary({
        method: selectedMethod,
        amount,
        amountReceived,
      }),
    [selectedMethod, amount, amountReceived]
  );

  const clearQueuedUpdates = () => {
    timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutsRef.current = [];
  };

  useEffect(() => {
    if (!isOpen) {
      clearQueuedUpdates();
      setIsRunning(false);
      setCurrentState("");
      setActivityLog([]);
      setResultMessage("");
      setShowReleasePrompt(false);
      setReleaseBusy(false);
    }
    return () => clearQueuedUpdates();
  }, [isOpen]);

  useEffect(() => {
    setAmount(invoiceTotal);
    setAmountReceived(invoiceTotal);
  }, [invoiceTotal, selectedMethodId]);

  useEffect(() => {
    if (!selectedMethod.allowedOutcomes.includes(selectedOutcome)) {
      setSelectedOutcome(selectedMethod.allowedOutcomes[0] || "success");
    }
  }, [selectedMethod, selectedOutcome]);

  const pushLog = (stateKey, labelOverride = "") => {
    const label = labelOverride || outcomeLabel(stateKey);
    setActivityLog((prev) => [
      ...prev,
      {
        key: `${stateKey}-${Date.now()}-${prev.length}`,
        state: stateKey,
        label,
        timestamp: new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  };

  const completeSimulation = async (finalOutcome) => {
    try {
      const response = await fetch("/api/invoices/payments/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice?.id,
          methodId: selectedMethod.id,
          outcome: finalOutcome,
          amount,
          amountReceived: selectedMethod.id === "cash" ? amountReceived : null,
          reference,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to complete simulated action");
      }

      if (selectedMethod.settlesInvoice && finalOutcome === "success") {
        const paymentResult = await onPaymentCompleted?.({
          methodId: selectedMethod.id,
          amount,
          invoice: payload.invoice,
          payment: payload.payment,
        });
        if (paymentResult?.success === false) {
          throw new Error(paymentResult.error || "Payment recorded but status update failed");
        }
        setShowReleasePrompt(true);
        setResultMessage(
          `${selectedMethod.label} recorded successfully. Job status moved to Invoiced.`
        );
      } else {
        setResultMessage(
          finalOutcome === "success"
            ? `${selectedMethod.label} action completed successfully.`
            : `${selectedMethod.label} finished with outcome: ${outcomeLabel(finalOutcome)}.`
        );
      }

      await onInvoiceActionComplete?.(payload);
    } catch (error) {
      console.error("Payment flow failed:", error);
      setCurrentState("failed");
      pushLog("failed", error.message || "Simulation failed");
      setResultMessage(error.message || "Simulation failed");
    } finally {
      setIsRunning(false);
    }
  };

  const runSimulation = () => {
    if (invoiceAlreadyPaid) {
      setResultMessage("Payment has already been captured for this invoice.");
      return;
    }
    clearQueuedUpdates();
    setIsRunning(true);
    setShowReleasePrompt(false);
    setResultMessage("");
    setActivityLog([]);

    const sequence = PAYMENT_FLOW_STEPS[selectedMethod.id] || ["processing"];
    let delay = 0;

    sequence.forEach((step) => {
      const timeoutId = setTimeout(() => {
        setCurrentState(step);
        pushLog(step);
      }, delay);
      timeoutsRef.current.push(timeoutId);
      delay += 900;
    });

    const outcomeTimeout = setTimeout(async () => {
      setCurrentState(selectedOutcome);
      pushLog(selectedOutcome);
      await completeSimulation(selectedOutcome);
    }, delay + 400);

    timeoutsRef.current.push(outcomeTimeout);
  };

  const handleReleaseDecision = async (shouldRelease) => {
    if (!shouldRelease) {
      setShowReleasePrompt(false);
      setResultMessage(
        "Release deferred. Use the Release button in the job card header when the vehicle is ready to leave."
      );
      return;
    }

    try {
      setReleaseBusy(true);
      const result = await onReleaseRequested?.();
      if (result?.success === false) {
        throw new Error(result.error || "Unable to release job");
      }
      setShowReleasePrompt(false);
      setResultMessage("Vehicle released successfully.");
      await onInvoiceActionComplete?.();
      onClose?.();
    } catch (error) {
      console.error("Release flow failed:", error);
      setResultMessage(error.message || "Unable to release vehicle");
    } finally {
      setReleaseBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className={styles.modalBackdrop}>
        <div className={styles.paymentModal}>
          <div className={styles.paymentModalHeader}>
            <div>
              <h2 style={{ margin: 0 }}>Payment Journey</h2>
              <p style={{ margin: "6px 0 0", color: "var(--text-secondary)" }}>
                {invoice?.invoice_number || "Invoice"} · {formatCurrency(invoiceTotal)}
              </p>
            </div>
            <button type="button" className={styles.secondaryActionButton} onClick={onClose}>
              Close
            </button>
          </div>

          <div className={styles.paymentModalGrid}>
            <aside className={styles.paymentMethodRail}>
              {PAYMENT_FLOW_METHODS.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedMethodId(method.id)}
                  className={styles.paymentMethodCard}
                  data-active={selectedMethodId === method.id ? "true" : "false"}
                >
                  <strong>{method.label}</strong>
                  <span>{method.category}</span>
                  <p>{method.description}</p>
                </button>
              ))}
            </aside>

            <section className={styles.paymentPanel}>
              <div className={styles.paymentPanelCard}>
                <div className={styles.paymentPanelHeading}>
                  <div>
                    <h3 style={{ margin: 0 }}>{methodSummary.title}</h3>
                    <p style={{ margin: "6px 0 0", color: "var(--text-secondary)" }}>
                      {methodSummary.description}
                    </p>
                  </div>
                  {currentState && (
                    <span
                      className={styles.invoiceStatusBadge}
                      style={toneStyle(PAYMENT_FLOW_OUTCOMES[currentState]?.tone)}
                    >
                      {outcomeLabel(currentState)}
                    </span>
                  )}
                </div>

                {selectedMethod.defaultAmountMode !== "none" && (
                  <div className={styles.paymentFieldGrid}>
                    <label className={styles.paymentField}>
                      <span>Payment amount</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(event) => setAmount(Number(event.target.value))}
                        disabled={isRunning}
                      />
                    </label>
                    {selectedMethod.id === "cash" && (
                      <label className={styles.paymentField}>
                        <span>Amount received</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={amountReceived}
                          onChange={(event) => setAmountReceived(Number(event.target.value))}
                          disabled={isRunning}
                        />
                      </label>
                    )}
                    <label className={styles.paymentField}>
                      <span>Reference / note</span>
                      <input
                        type="text"
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                        placeholder={
                          selectedMethod.id === "phone"
                            ? "Advisor initials / auth note"
                            : "Optional payment reference"
                        }
                        disabled={isRunning}
                      />
                    </label>
                  </div>
                )}

                {selectedMethod.id === "phone" && (
                  <div className={styles.paymentNoteBox}>
                    <strong>Operational checklist</strong>
                    <p>
                      Confirm the customer, quote the balance, verify cardholder authority, and
                      note the adviser taking the call.
                    </p>
                    <p>
                      {selectedMethod.backendTodo}
                    </p>
                  </div>
                )}

                {(selectedMethod.id === "email" || selectedMethod.id === "portal_publish") && (
                  <div className={styles.paymentNoteBox}>
                    <strong>Delivery target</strong>
                    <p>
                      {selectedMethod.id === "email"
                        ? customerEmail || "No customer email recorded on this job card."
                        : "Customer portal outstanding balance ledger"}
                    </p>
                  </div>
                )}

                <div className={styles.outcomeSelector}>
                  {selectedMethod.allowedOutcomes.map((outcome) => (
                    <button
                      key={outcome}
                      type="button"
                      onClick={() => setSelectedOutcome(outcome)}
                      className={styles.outcomeChip}
                      data-active={selectedOutcome === outcome ? "true" : "false"}
                      disabled={isRunning}
                    >
                      {outcomeLabel(outcome)}
                    </button>
                  ))}
                </div>

                <div className={styles.paymentActionRow}>
                  <button
                    type="button"
                    className={styles.primaryActionButton}
                    onClick={runSimulation}
                    disabled={
                      invoiceAlreadyPaid ||
                      isRunning ||
                      (selectedMethod.id === "cash" && Number(amountReceived || 0) <= 0)
                    }
                  >
                    {invoiceAlreadyPaid
                      ? "Payment Already Captured"
                      : isRunning
                      ? "Running simulation..."
                      : `Run ${selectedMethod.label}`}
                  </button>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    Test flow only. Real gateway execution is still pending backend integration.
                  </span>
                </div>
              </div>

              <div className={styles.paymentPanelCard}>
                <h3 style={{ marginTop: 0 }}>Transaction activity</h3>
                {activityLog.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                    Select a method, choose a simulated outcome, and run the flow.
                  </p>
                ) : (
                  <div className={styles.activityTimeline}>
                    {activityLog.map((entry) => (
                      <div key={entry.key} className={styles.activityTimelineItem}>
                        <div>
                          <strong>{entry.label}</strong>
                          <p>{entry.timestamp}</p>
                        </div>
                        <span
                          className={styles.invoiceStatusBadge}
                          style={toneStyle(PAYMENT_FLOW_OUTCOMES[entry.state]?.tone)}
                        >
                          {outcomeLabel(entry.state)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {resultMessage && (
                  <div className={styles.paymentNoteBox} style={{ marginTop: "16px" }}>
                    {resultMessage}
                  </div>
                )}
                {showReleasePrompt && (
                  <div className={styles.releasePromptBox}>
                    <h4 style={{ margin: "0 0 8px" }}>Release vehicle now?</h4>
                    <p style={{ margin: "0 0 12px", color: "var(--text-secondary)" }}>
                      Payment has been completed. Confirm whether the vehicle or job can now be released.
                    </p>
                    <div className={styles.paymentActionRow}>
                      <button
                        type="button"
                        className={styles.primaryActionButton}
                        onClick={() => handleReleaseDecision(true)}
                        disabled={releaseBusy}
                      >
                        {releaseBusy ? "Releasing..." : "Yes, release"}
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryActionButton}
                        onClick={() => handleReleaseDecision(false)}
                        disabled={releaseBusy}
                      >
                        No, keep on site
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
