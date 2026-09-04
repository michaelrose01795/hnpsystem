// file location: src/components/customers/CustomerDetailsCard.js
// Shared "Customer Details" card. Extracted verbatim from the Create Job Card
// page so /new-job and /new-order render an identical card — same readonly
// grid, same edit mode, same action buttons. Page-specific wiring (which
// popups open, where edits persist) arrives through props.
import LayerTheme from "@/components/ui/LayerTheme";
import BufferedInput from "@/components/ui/BufferedInput"; // local-state text input; notifies the parent on a debounce (flushes on blur)
import Button from "@/components/ui/Button";
import StatusMessage from "@/components/ui/StatusMessage";
import { CUSTOMER_FIELD_DEFINITIONS } from "@/lib/customers/customerRecord";

const CUSTOMER_SELECTION_LABEL_STYLE = { fontSize: "var(--text-label)", fontWeight: 500, color: "var(--text-1)", display: "block", marginBottom: "2px" }; // Matches the shared form-label typography while labelling a two-button group.

export default function CustomerDetailsCard({
  customer,
  setCustomer,
  customerForm,
  customerFieldDefinitions = CUSTOMER_FIELD_DEFINITIONS,
  isCustomerEditing = false,
  isSavingCustomer = false,
  notification = null,
  onDismissNotification,
  handleCustomerFieldChange,
  toggleContactPreference,
  handleStartCustomerEdit,
  handleSaveCustomerEdits,
  handleCancelCustomerEdit,
  onExistingCustomer,
  onNewCustomer,
  emptySelectionLabel = "",
  inherited = false,
  sectionKey,
  parentKey,
  className = "",
  style,
  children, // optional page-specific extras rendered below the card body
}) {
  return (
    <LayerTheme
      sectionKey={sectionKey}
      sectionType="content-card"
      parentKey={parentKey}
      className={`job-cards-create-aligned-card job-cards-create-aligned-card--customer ${className}`.trim()}
      radius="var(--radius-md)"
      gap="16px"
      style={style}
    >
      <div className="job-cards-create-aligned-card__header">
        <h3>
          Customer Details
          {inherited && <span className="app-badge app-badge--accent-soft" style={{ marginLeft: "8px" }}>
              Inherited
            </span>}
        </h3>

        {notification && <StatusMessage tone={notification.type === "success" ? "success" : "danger"} style={{
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span>{notification.message}</span>
          <Button type="button" variant="ghost" size="xs" className="app-btn--icon" onClick={() => onDismissNotification?.(null)} style={{
            marginLeft: "auto"
          }} aria-label="Dismiss customer notification">
            ×
            </Button>
          </StatusMessage>}
      </div>

      {customer ? <div className="job-cards-create-customer-content" style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}>
          {isCustomerEditing ? <div className="job-cards-create-customer-fields job-cards-create-customer-fields--editing" style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "12px"
          }}>
              {customerFieldDefinitions.map(input => <div key={input.field} className={`job-cards-create-customer-field job-cards-create-customer-field--${input.field}`} style={{
                gridColumn: input.field === "email" || input.field === "address" || input.field === "contactPreference" ? "1 / -1" : "auto"
              }}>
                  <label htmlFor={input.type === "multi-select" ? undefined : `customer-${input.field}`}>
                    {input.label}
                  </label>
                  {input.type === "textarea" ? <BufferedInput as="textarea" id={`customer-${input.field}`} value={customerForm[input.field] || ""} onChange={next => handleCustomerFieldChange(input.field, next)} disabled={!isCustomerEditing || isSavingCustomer} placeholder={input.placeholder} rows={3} className="app-input app-input--textarea" /> : input.type === "multi-select" ? <div style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    width: "100%"
                  }}>
                      {["phone", "email", "sms"].map(pref => {
                        const active = Array.isArray(customerForm.contactPreference) && customerForm.contactPreference.includes(pref);
                        return <Button key={pref} type="button" variant="secondary" size="sm" className={active ? "is-active" : ""} aria-pressed={active} onClick={() => toggleContactPreference(pref)}>
                                 {pref === "sms" ? "SMS" : pref.charAt(0).toUpperCase() + pref.slice(1)}
                               </Button>;
                      })}
                    </div> : <BufferedInput id={`customer-${input.field}`} type={input.type} value={customerForm[input.field] || ""} onChange={next => handleCustomerFieldChange(input.field, next)} disabled={!isCustomerEditing || isSavingCustomer} placeholder={input.placeholder} className="app-input" />}
                </div>)}
            </div> : <div className="job-cards-create-customer-fields job-cards-create-customer-fields--readonly" style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "8px"
          }}>
              {customerFieldDefinitions.filter(input => input.field !== "contactPreference").map(input => <div key={input.field} className={`job-cards-create-customer-field job-cards-create-customer-field--${input.field}`} style={{
                gridColumn: input.field === "firstName" || input.field === "lastName" || input.field === "mobile" || input.field === "telephone" ? "auto" : "1 / -1",
                minWidth: 0
              }}>
                    <label htmlFor={`customer-readonly-${input.field}`}>
                      {input.label}
                    </label>
                    <input id={`customer-readonly-${input.field}`} className="app-input" value={customerForm[input.field] || "Not provided"} readOnly />
                  </div>)}
            </div>}

          <div className={`job-cards-create-customer-actions${isCustomerEditing ? " job-cards-create-customer-actions--editing" : ""}`} style={{
            display: "flex",
            gap: "10px",
            justifyContent: "center",
            alignItems: "flex-start",
            flexWrap: "nowrap"
          }}>
            {isCustomerEditing ? <>
                <Button type="button" onClick={handleSaveCustomerEdits} busy={isSavingCustomer} style={{
                  flex: 1
                }}>
                  {isSavingCustomer ? "Saving..." : "Save Changes"}
                </Button>
                <Button type="button" variant="secondary" onClick={handleCancelCustomerEdit} disabled={isSavingCustomer} style={{
                  flex: 1
                }}>
                  Cancel
                </Button>
              </> : <>
                <Button type="button" variant="primary" onClick={handleStartCustomerEdit} style={{
                  flex: "1 1 0",
                  minWidth: 0
                }}>
                  Edit Customer
                </Button>
                <Button type="button" variant="secondary" onClick={() => setCustomer(null)} disabled={isSavingCustomer} style={{
                  flex: "1 1 0",
                  minWidth: 0
                }}>
                  Clear Customer
                </Button>
              </>}
          </div>

          {isCustomerEditing && <Button type="button" variant="ghost" className="job-cards-create-customer-clear-editing" onClick={() => setCustomer(null)} disabled={isSavingCustomer} style={{
            width: "100%",
            maxWidth: "320px",
            alignSelf: "center"
          }}>
              Clear Customer
            </Button>}
        </div> : <div style={{ display: "flex", flexDirection: "column" }}>
          {emptySelectionLabel ? <span style={CUSTOMER_SELECTION_LABEL_STYLE}>{emptySelectionLabel}</span> : null}
          <div className="job-cards-create-customer-actions job-cards-create-customer-actions--empty" role="group" aria-label={emptySelectionLabel || "Customer actions"} style={{
          display: "flex",
          gap: "10px",
          alignItems: "flex-start"
        }}>
            <Button type="button" data-presentation="create-customer-lookup" variant="primary" onClick={onExistingCustomer} style={{
              flex: "1 1 0",
              minWidth: 0
            }}>
              Existing Customer
            </Button>
            <Button type="button" variant="secondary" onClick={onNewCustomer} style={{
              flex: "1 1 0",
              minWidth: 0
            }}>
              New Customer
            </Button>
          </div>
        </div>}

      {children}
    </LayerTheme>
  );
}
